import { supabaseAdmin } from "../config/supabase.js";
import { cleanString } from "../utils/utils.js";

export const usuarioService = {
    async createUsuario(data: any): Promise<any> {
        console.log("[createUsuario] Iniciando criação...", { email: data.email, perfil: data.perfil_id });
        
        if (!data.email) throw new Error("Email é obrigatório");
        if (!data.nome_completo) throw new Error("Nome completo é obrigatório");
        if (!data.perfil_id) throw new Error("Perfil é obrigatório");

        // 1. Create Auth User
        const tempPassword = "Tempo" + Math.random().toString(36).slice(-8) + "!"; // Strong temp password
        console.log("[createUsuario] Criando usuário no Auth...");
        
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
                nome_completo: data.nome_completo
            }
        });

        if (authError) {
            console.error("[createUsuario] Erro no Auth:", authError);
            throw authError;
        }
        
        if (!authUser?.user) {
             console.error("[createUsuario] Usuário não retornado pelo Auth");
             throw new Error("Erro ao criar usuário no Auth");
        }

        console.log("[createUsuario] Usuário Auth criado:", authUser.user.id);

        const { turnos, ...rest } = data;

        const usuarioData: any = {
            ...rest,
            id: authUser.user.id, // Use Auth ID
            nome_completo: cleanString(data.nome_completo),
            ativo: data.ativo !== undefined ? data.ativo : true,
            primeiro_acesso: true, // Force password change
        };

        console.log("[createUsuario] Inserindo no banco...");
        const { data: inserted, error } = await supabaseAdmin
            .from("usuarios")
            .insert([usuarioData])
            .select("*, perfil:perfis(*), cliente:clientes(*)")
            .single();

        if (error) {
            console.error("[createUsuario] Erro no Banco:", error);
            // Rollback Auth if DB fails
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            throw error;
        }
        
        console.log("[createUsuario] Sucesso DB. ID:", inserted.id);

        // Sync turnos if provided
        if (turnos && Array.isArray(turnos)) {
            console.log("[createUsuario] Inserindo turnos:", turnos.length);
            const turnosData = turnos.map(t => ({
                usuario_id: inserted.id,
                hora_inicio: t.hora_inicio,
                hora_fim: t.hora_fim
            }));
            const { error: turnosError } = await supabaseAdmin
                .from("usuario_turnos")
                .insert(turnosData);
            if (turnosError) {
                 console.error("[createUsuario] Erro ao inserir turnos:", turnosError);
                 throw turnosError;
            }
        }

        return this.getUsuario(inserted.id);
    },

    async updateUsuario(id: string, data: Partial<any>): Promise<any> {
        if (!id) throw new Error("ID do usuário é obrigatório");

        const { turnos, ...rest } = data;

        const usuarioData: any = { ...rest };
        if (data.nome_completo) usuarioData.nome_completo = cleanString(data.nome_completo);

        const { data: updated, error } = await supabaseAdmin
            .from("usuarios")
            .update(usuarioData)
            .eq("id", id)
            .select("*, perfil:perfis(*), cliente:clientes(*)")
            .single();
        if (error) throw error;

        // Sync turnos if provided
        if (turnos && Array.isArray(turnos)) {
            // Remove existing turnos and insert new ones (simple sync)
            const { error: deleteError } = await supabaseAdmin
                .from("usuario_turnos")
                .delete()
                .eq("usuario_id", id);
            if (deleteError) throw deleteError;

            const turnosData = turnos.map(t => ({
                usuario_id: id,
                hora_inicio: t.hora_inicio,
                hora_fim: t.hora_fim
            }));
            const { error: turnosError } = await supabaseAdmin
                .from("usuario_turnos")
                .insert(turnosData);
            if (turnosError) throw turnosError;
        }

        return this.getUsuario(id);
    },

    async getUsuario(id: string): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("usuarios")
            .select("*, perfil:perfis(*), cliente:clientes(*), turnos:usuario_turnos(*)")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    async listUsuarios(filtros?: {
        searchTerm?: string;
        perfil_id?: number;
        cliente_id?: number;
        ativo?: string;
    }): Promise<any[]> {
        let query = supabaseAdmin
            .from("usuarios")
            .select("*, perfil:perfis(*), cliente:clientes(*), turnos:usuario_turnos(*)")
            .order("nome_completo", { ascending: true });

        if (filtros?.searchTerm) {
            query = query.or(
                `nome_completo.ilike.%${filtros.searchTerm}%,email.ilike.%${filtros.searchTerm}%,cpf.ilike.%${filtros.searchTerm}%`
            );
        }

        if (filtros?.perfil_id) query = query.eq("perfil_id", filtros.perfil_id);
        if (filtros?.cliente_id) query = query.eq("cliente_id", filtros.cliente_id);
        
        // Fix: Explicitly check for boolean true/false string
        if (filtros?.ativo !== undefined && filtros.ativo !== "todos") {
             query = query.eq("ativo", filtros.ativo === "true");
        }

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
    },

    async deleteUsuario(id: string): Promise<void> {
        if (!id) throw new Error("ID do usuário é obrigatório");
        
        // Delete from Auth (Cascade should handle public.usuarios if configured, otherwise we delete manually too)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) {
             // If user not found in auth (already deleted or inconsistent), try deleting from DB directly to clean up
             console.warn("User not found in Auth during delete, attempting DB delete:", authError.message);
        }

        // Explicitly delete turnos first to ensure no FK constraint issues
        await supabaseAdmin.from("usuario_turnos").delete().eq("usuario_id", id);

        // Always try to delete from public DB to ensure consistency (idempotent if cascade worked)
        const { error } = await supabaseAdmin
            .from("usuarios")
            .delete()
            .eq("id", id);
            
        if (error) throw error;
    },

    async toggleAtivo(id: string, novoStatus: boolean): Promise<boolean> {
        const { error } = await supabaseAdmin
            .from("usuarios")
            .update({ ativo: novoStatus })
            .eq("id", id);

        if (error) throw new Error(`Falha ao ${novoStatus ? "ativar" : "desativar"} o usuário.`);
        return novoStatus;
    },
};