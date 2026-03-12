import { STATUS } from "../config/constants.js";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { cleanString, getNowBR, onlyDigits, toLocalDateString } from "../utils/utils.js";
import { colaboradorClienteService } from "./colaborador-cliente.service.js";

export const usuarioService = {
    async createUsuario(data: any): Promise<any> {
        const emailNormalizado = data.email?.toLowerCase().trim();
        if (!emailNormalizado) throw new Error(messages.usuario.erro.emailObrigatorio);
        if (!data.nome_completo) throw new Error(messages.usuario.erro.nomeObrigatorio);
        if (!data.perfil_id) throw new Error(messages.usuario.erro.perfilObrigatorio);

        // 1. Create Auth User
        const cpfDigits = onlyDigits(data.cpf);
        const tempPassword = cpfDigits.substring(0, 6);

        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: emailNormalizado,
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
            throw new Error(messages.usuario.erro.criarAuth);
        }

        // Extract fields that don't belong to the 'usuarios' table
        const { links, turnos, ...rest } = data;

        // Prepare Usuario Data
        const usuarioData: any = {
            ...rest,
            id: authUser.user.id,
            email: emailNormalizado,
            nome_completo: cleanString(data.nome_completo),
            perfil_id: data.perfil_id,
            cpf: onlyDigits(data.cpf),
            cnpj: (data.cnpj === undefined || data.cnpj === null || data.cnpj.trim() === "") ? null : data.cnpj,
            telefone: onlyDigits(data.telefone),
            telefone_recado: data.telefone_recado?.trim() === "" ? null : onlyDigits(data.telefone_recado),
            status: data.status || STATUS.ATIVO,
            tipo_chave_pix: data.tipo_chave_pix || "CPF",
            chave_pix: data.chave_pix || null,
            senha_padrao: data.status === STATUS.PENDENTE ? false : true
        };

        if (usuarioData.perfil_id) usuarioData.perfil_id = parseInt(usuarioData.perfil_id);

        const { data: inserted, error } = await supabaseAdmin
            .from("usuarios")
            .insert([usuarioData])
            .select("*, perfil:perfis(*)")
            .single();

        if (error) {
            console.error("[createUsuario] Erro no Banco:", error);
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);

            // Handle unique constraint violations
            if (error.code === '23505') {
                if (error.message?.includes('cpf')) {
                    throw new Error(messages.usuario.erro.cpfJaExiste);
                }
                if (error.message?.includes('email')) {
                    throw new Error(messages.usuario.erro.emailJaExiste);
                }
            }
            throw error;
        }

        return this.getUsuario(inserted.id);
    },

    async updateUsuario(id: string, data: Partial<any>): Promise<any> {
        if (!id) throw new Error(messages.usuario.erro.idObrigatorio);

        // Extract fields that don't belong to the 'usuarios' table or are handled separately
        const { links, turnos, cliente_id, empresa_id, ativo, ...rest } = data;

        const usuarioData: any = { ...rest };
        if (ativo !== undefined) {
            usuarioData.status = ativo ? STATUS.ATIVO : STATUS.INATIVO;
        }
        if (data.nome_completo !== undefined) usuarioData.nome_completo = cleanString(data.nome_completo);
        if (data.cpf !== undefined) usuarioData.cpf = onlyDigits(data.cpf);
        if (data.telefone !== undefined) usuarioData.telefone = onlyDigits(data.telefone);
        if (data.telefone_recado !== undefined) {
            usuarioData.telefone_recado = data.telefone_recado?.trim() === "" ? null : onlyDigits(data.telefone_recado);
        }
        if (data.cnpj !== undefined) {
            usuarioData.cnpj = data.cnpj?.trim() === "" ? null : data.cnpj;
        }
        if (data.tipo_chave_pix !== undefined) {
            usuarioData.tipo_chave_pix = data.tipo_chave_pix || "CPF";
        }
        if (data.chave_pix !== undefined) {
            usuarioData.chave_pix = data.chave_pix || null;
        }


        const { data: updated, error } = await supabaseAdmin
            .from("usuarios")
            .update(usuarioData)
            .eq("id", id)
            .select("*, perfil:perfis(*)")
            .single();

        if (error) {
            console.error("[updateUsuario] Erro no Banco:", error);
            // Handle unique constraint violations
            if (error.code === '23505') {
                if (error.message?.includes('cpf')) {
                    throw new Error(messages.usuario.erro.cpfJaExiste);
                }
                if (error.message?.includes('email')) {
                    throw new Error(messages.usuario.erro.emailJaExiste);
                }
            }
            throw error;
        }

        return this.getUsuario(id);
    },

    async getUsuario(id: string): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("usuarios")
            .select("*, perfil:perfis(*)")
            .eq("id", id)
            .single();
        if (error) throw error;

        // Fetch Links separately (or could use join if configured)
        const links = await colaboradorClienteService.listLinks(id);

        return { ...data, links }; // Return nested links
    },

    async listUsuarios(filtros?: {
        searchTerm?: string;
        perfil_id?: number;
        cliente_id?: number;
        empresa_id?: number;
        status?: string;
        sem_ponto_hoje?: boolean;
    }): Promise<any[]> {
        let query = supabaseAdmin
            .from("usuarios")
            .select("*, perfil:perfis(*), links:colaborador_clientes(*, cliente:clientes(nome_fantasia), empresa:empresas(nome_fantasia))")
            .order("nome_completo", { ascending: true });

        if (filtros?.searchTerm) {
            query = query.or(
                `nome_completo.ilike.%${filtros.searchTerm}%,email.ilike.%${filtros.searchTerm}%,cpf.ilike.%${filtros.searchTerm}%`
            );
        }

        if (filtros?.perfil_id) query = query.eq("perfil_id", filtros.perfil_id);

        if (filtros?.status && filtros.status !== "todos") {
            if (filtros.status === 'ativo') {
                query = query.eq("status", STATUS.ATIVO);
            } else if (filtros.status === 'inativo') {
                query = query.eq("status", STATUS.INATIVO);
                // Let's assume strict mapping for now, but usually 'inativo' in filter might mean everything not active.
                // Given the specific new statuses, let's map commonly.
                // But wait, the frontend might send 'PENDENTE' specifically.
                // Let's stick to what the value actually is if it matches a known status.
            } else {
                query = query.eq("status", filtros.status.toUpperCase());
            }
        }

        const { data: users, error } = await query;
        if (error) throw error;

        let result = users || [];

        // Fetch today's points for all listed users
        const hoje = toLocalDateString(new Date());
        const userIds = result.map((u: any) => u.id);

        if (userIds.length > 0) {
            const { data: pontosHoje } = await supabaseAdmin
                .from("registros_ponto")
                .select("*")
                .in("usuario_id", userIds)
                .eq("data_referencia", hoje);

            if (pontosHoje) {
                result = result.map((u: any) => ({
                    ...u,
                    ponto_hoje: pontosHoje.find((p: any) => p.usuario_id === u.id) || null
                }));
            }
        }

        // Apply Link Filters (Client/Company)
        if (filtros?.cliente_id && filtros.cliente_id.toString() !== 'todos') {
            result = result.filter((u: any) =>
                u.links?.some((l: any) => l.cliente_id?.toString() === filtros.cliente_id?.toString())
            );
        }

        if (filtros?.empresa_id && filtros.empresa_id.toString() !== 'todos') {
            result = result.filter((u: any) =>
                u.links?.some((l: any) => l.empresa_id?.toString() === filtros.empresa_id?.toString())
            );
        }

        // Filter by "No point today" if requested
        if (filtros?.sem_ponto_hoje) {
            result = result.filter((u: any) => !u.ponto_hoje);
        }

        return result;
    },

    async deleteUsuario(id: string): Promise<void> {
        if (!id) throw new Error(messages.usuario.erro.idObrigatorio);

        // Delete from Auth (Cascade should handle public.usuarios if configured, otherwise we delete manually too)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) {
            // If user not found in auth (already deleted or inconsistent), try deleting from DB directly to clean up
            console.warn("User not found in Auth during delete, attempting DB delete:", authError.message);
        }

        // Explicitly delete links first to ensure no FK constraint issues
        await supabaseAdmin.from("colaborador_clientes").delete().eq("colaborador_id", id);

        // Always try to delete from public DB to ensure consistency (idempotent if cascade worked)
        const { error } = await supabaseAdmin
            .from("usuarios")
            .delete()
            .eq("id", id);

        if (error) throw error;
    },

    async updateStatus(id: string, novoStatus: string): Promise<string> {
        const { error } = await supabaseAdmin
            .from("usuarios")
            .update({ status: novoStatus })
            .eq("id", id);

        if (error) throw new Error(`${messages.usuario.erro.atualizarStatus} ${novoStatus}.`);
        return novoStatus;
    },
};