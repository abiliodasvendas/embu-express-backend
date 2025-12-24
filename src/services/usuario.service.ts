import { supabaseAdmin } from "../config/supabase.js";
import { cleanString } from "../utils/utils.js";

export const usuarioService = {
    async createUsuario(data: any): Promise<any> {
        if (!data.email) throw new Error("Email é obrigatório");
        if (!data.nome_completo) throw new Error("Nome completo é obrigatório");
        if (!data.perfil_id) throw new Error("Perfil é obrigatório");

        const { turnos, ...rest } = data;

        const usuarioData: any = {
            ...rest,
            nome_completo: cleanString(data.nome_completo),
            ativo: data.ativo !== undefined ? data.ativo : true,
            primeiro_acesso: data.primeiro_acesso !== undefined ? data.primeiro_acesso : true,
        };

        const { data: inserted, error } = await supabaseAdmin
            .from("usuarios")
            .insert([usuarioData])
            .select("*, perfil:perfis(*), cliente:clientes(*)")
            .single();
        if (error) throw error;

        // Sync turnos if provided
        if (turnos && Array.isArray(turnos)) {
            const turnosData = turnos.map(t => ({
                usuario_id: inserted.id,
                hora_inicio: t.hora_inicio,
                hora_fim: t.hora_fim
            }));
            const { error: turnosError } = await supabaseAdmin
                .from("usuario_turnos")
                .insert(turnosData);
            if (turnosError) throw turnosError;
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
        search?: string;
        perfil_id?: number;
        cliente_id?: number;
        ativo?: boolean;
    }): Promise<any[]> {
        let query = supabaseAdmin
            .from("usuarios")
            .select("*, perfil:perfis(*), cliente:clientes(*)")
            .order("nome_completo", { ascending: true });

        if (filtros?.search) {
            query = query.or(
                `nome_completo.ilike.%${filtros.search}%,email.ilike.%${filtros.search}%,cpf.ilike.%${filtros.search}%`
            );
        }

        if (filtros?.perfil_id) query = query.eq("perfil_id", filtros.perfil_id);
        if (filtros?.cliente_id) query = query.eq("cliente_id", filtros.cliente_id);
        if (filtros?.ativo !== undefined) query = query.eq("ativo", filtros.ativo);

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
    },

    async deleteUsuario(id: string): Promise<void> {
        if (!id) throw new Error("ID do usuário é obrigatório");
        
        const { error } = await supabaseAdmin
            .from("usuarios")
            .update({ ativo: false })
            .eq("id", id);
            
        if (error) throw error;
    }
};