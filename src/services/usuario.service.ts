import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { cleanString, onlyNumbers } from "../utils/utils.js";
import { AppError } from "../errors/AppError.js";
import { colaboradorClienteService } from "./colaborador-cliente.service.js";
import { PIX_TYPES } from "../constants/financeiro.enum.js";
import { Usuario } from "../types/database.js";
import { createUsuarioSchema, updateUsuarioSchema } from "../schemas/usuario.schema.js";
import { z } from "zod";

type CreateUsuarioDTO = z.infer<typeof createUsuarioSchema>;
type UpdateUsuarioDTO = z.infer<typeof updateUsuarioSchema>;

export const usuarioService = {
    async createUsuario(data: CreateUsuarioDTO): Promise<Usuario> {
        const emailNormalizado = data.email?.toLowerCase().trim();
        if (!emailNormalizado) throw new AppError(messages.usuario.erro.emailObrigatorio);
        if (!data.nome_completo) throw new AppError(messages.usuario.erro.nomeObrigatorio);
        if (!data.perfil_id) throw new AppError(messages.usuario.erro.perfilObrigatorio);

        const cpfDigits = onlyNumbers(data.cpf);
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
            if (authError.message?.includes("already been registered") || authError.status === 422) {
                throw new AppError(messages.usuario.erro.emailJaExiste, 400);
            }
            console.error("[createUsuario] Erro no Auth:", authError);
            throw authError;
        }

        if (!authUser?.user) {
            throw new AppError(messages.usuario.erro.criarAuth, 500);
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { links, turnos, silent, created_at, updated_at, ...rest } = data;

        const usuarioData: Partial<Usuario> = {
            ...rest,
            id: authUser.user.id,
            email: emailNormalizado,
            nome_completo: cleanString(data.nome_completo || ""),
            perfil_id: Number(data.perfil_id),
            cpf: onlyNumbers(data.cpf || ""),
            cnpj: data.cnpj ? onlyNumbers(data.cnpj) : null,
            telefone: data.telefone ? onlyNumbers(data.telefone) : null,
            telefone_recado: onlyNumbers(data.telefone_recado) || null,
            status: (data.status as "PENDENTE" | "ATIVO" | "INATIVO") || CADASTRO_STATUS.ATIVO,
            tipo_chave_pix: data.tipo_chave_pix || PIX_TYPES.CPF,
            chave_pix: data.chave_pix || null,
            senha_padrao: data.status === CADASTRO_STATUS.PENDENTE ? false : true
        } as Partial<Usuario>;


        const { error } = await supabaseAdmin
            .from("usuarios")
            .insert([usuarioData]);

        if (error) {
            console.error("[createUsuario] Erro no Banco:", error);
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);

            if (error.code === '23505') {
                if (error.message?.includes('cpf')) {
                    throw new AppError(messages.usuario.erro.cpfJaExiste, 409);
                }
                if (error.message?.includes('email')) {
                    throw new AppError(messages.usuario.erro.emailJaExiste, 409);
                }
            }
            throw error;
        }

        return this.getUsuario(authUser.user.id);
    },

    async updateUsuario(id: string, data: UpdateUsuarioDTO, executorId?: string): Promise<Usuario> {
        if (!id) throw new AppError(messages.usuario.erro.idObrigatorio);

        if (data.status === CADASTRO_STATUS.INATIVO) {
            if (executorId === id) {
                throw new AppError(messages.usuario.erro.autoDesativacao);
            }
        }

        const { data: usuarioAtual, error: fetchError } = await supabaseAdmin
            .from("usuarios")
            .select("email, cpf, senha_padrao")
            .eq("id", id)
            .single();

        if (fetchError) {
            console.error("[updateUsuario] Erro ao buscar usuário atual:", fetchError);
            throw fetchError;
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { links, turnos, cliente_id, empresa_id, ativo, silent, created_at, updated_at, ...rest } = data;

        const usuarioData: Partial<Usuario> = { ...rest } as Partial<Usuario>;

        if (data.nome_completo !== undefined) usuarioData.nome_completo = cleanString(data.nome_completo || "");
        
        if (data.email !== undefined) {
            const novoEmail = data.email.toLowerCase().trim();
            usuarioData.email = novoEmail;

            if (novoEmail !== usuarioAtual.email?.toLowerCase().trim()) {
                const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
                    email: novoEmail
                });

                if (authError) {
                    console.error("[updateUsuario] Falha ao atualizar email no Auth:", authError);
                    throw authError;
                }
            }
        }

        if (data.cpf !== undefined) {
            const novoCpf = onlyNumbers(data.cpf || "");
            usuarioData.cpf = novoCpf;

            if (usuarioAtual.senha_padrao) {
                const cpfAtual = onlyNumbers(usuarioAtual.cpf || "");
                if (novoCpf !== cpfAtual) {
                    const novaSenha = novoCpf.substring(0, 6);
                    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
                        password: novaSenha
                    });

                    if (authError) {
                        console.error("[updateUsuario] Falha ao atualizar senha no Auth:", authError);
                        throw authError;
                    }
                }
            }
        }
        if (data.telefone !== undefined) usuarioData.telefone = data.telefone ? onlyNumbers(data.telefone) : null;
        if (data.telefone_recado !== undefined) {
            usuarioData.telefone_recado = onlyNumbers(data.telefone_recado) || null;
        }
        if (data.cnpj !== undefined) {
            usuarioData.cnpj = data.cnpj ? onlyNumbers(data.cnpj) : null;
        }
        if (data.tipo_chave_pix !== undefined) {
            usuarioData.tipo_chave_pix = data.tipo_chave_pix || PIX_TYPES.CPF;
        }
        if (data.status !== undefined) {
            usuarioData.status = data.status as "PENDENTE" | "ATIVO" | "INATIVO";
        }
        if (data.chave_pix !== undefined) {
            usuarioData.chave_pix = data.chave_pix || null;
        }

        const { error } = await supabaseAdmin
            .from("usuarios")
            .update(usuarioData)
            .eq("id", id);

        if (error) {
            console.error("[updateUsuario] Erro no Banco:", error);
            if (error.code === '23505') {
                if (error.message?.includes('cpf')) {
                    throw new AppError(messages.usuario.erro.cpfJaExiste, 409);
                }
                if (error.message?.includes('email')) {
                    throw new AppError(messages.usuario.erro.emailJaExiste, 409);
                }
            }
            throw error;
        }

        return this.getUsuario(id);
    },

    async getUsuario(id: string): Promise<Usuario> {
        const { data, error } = await supabaseAdmin
            .from("usuarios")
            .select("*, perfil:perfis(*, perfil_permissoes(*, permissao:permissoes(*)))")
            .eq("id", id)
            .single();
        if (error) throw error;

        const links = await colaboradorClienteService.listLinks(id);

        return { ...data, links } as Usuario;
    },

    async listUsuarios(filtros?: {
        searchTerm?: string;
        perfil_id?: number;
        cliente_id?: number;
        empresa_id?: number;
        status?: string;
    }): Promise<Usuario[]> {
        let query = supabaseAdmin
            .from("usuarios")
            .select("*, perfil:perfis(*, perfil_permissoes(*, permissao:permissoes(*))), links:colaborador_clientes(*, cliente:clientes(nome_fantasia), empresa:empresas(nome_fantasia), horarios:colaborador_cliente_horarios(*))")
            .order("nome_completo", { ascending: true });

        if (filtros?.searchTerm) {
            query = query.or(
                `nome_completo.ilike.%${filtros.searchTerm}%,email.ilike.%${filtros.searchTerm}%,cpf.ilike.%${filtros.searchTerm}%`
            );
        }

        if (filtros?.perfil_id) query = query.eq("perfil_id", filtros.perfil_id);

        if (filtros?.status && filtros.status !== "todos") {
            if (filtros.status === 'ativo') {
                query = query.eq("status", CADASTRO_STATUS.ATIVO);
            } else if (filtros.status === 'inativo') {
                query = query.eq("status", CADASTRO_STATUS.INATIVO);
            } else if (filtros.status === 'pendente') {
                query = query.eq("status", CADASTRO_STATUS.PENDENTE);
            } else {
                query = query.eq("status", filtros.status.toUpperCase());
            }
        }

        const { data: users, error } = await query;
        if (error) throw error;

        let result = users || [];

        if (filtros?.cliente_id && filtros.cliente_id.toString() !== 'todos') {
            result = result.filter((u: Usuario) =>
                u.links?.some((l) => l.cliente_id?.toString() === filtros.cliente_id?.toString())
            );
        }

        if (filtros?.empresa_id && filtros.empresa_id.toString() !== 'todos') {
            result = result.filter((u: Usuario) =>
                u.links?.some((l) => l.empresa_id?.toString() === filtros.empresa_id?.toString())
            );
        }

        return (result || []) as Usuario[];
    },

    async deleteUsuario(id: string, executorId?: string): Promise<void> {
        if (!id) throw new AppError(messages.usuario.erro.idObrigatorio);

        if (executorId === id) {
            throw new AppError(messages.usuario.erro.autoExclusao);
        }

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
        if (authError) {
            console.warn("User not found in Auth during delete, attempting DB delete:", authError.message);
        }

        await supabaseAdmin.from("colaborador_clientes").delete().eq("colaborador_id", id);

        const { error } = await supabaseAdmin
            .from("usuarios")
            .delete()
            .eq("id", id);

        if (error) throw error;
    },

    async updateStatus(id: string, novoStatus: string, executorId?: string): Promise<string> {
        if (novoStatus === CADASTRO_STATUS.INATIVO && executorId === id) {
            throw new AppError(messages.usuario.erro.autoDesativacao);
        }

        const { error } = await supabaseAdmin
            .from("usuarios")
            .update({ status: novoStatus })
            .eq("id", id);

        if (error) throw new AppError(`${messages.usuario.erro.atualizarStatus} ${novoStatus}.`, 500);
        return novoStatus;
    },

    async resetPassword(id: string, executorId?: string): Promise<void> {
        if (!id) throw new AppError(messages.usuario.erro.idObrigatorio);

        const { data: usuarioAtual, error: fetchError } = await supabaseAdmin
            .from("usuarios")
            .select("cpf")
            .eq("id", id)
            .single();

        if (fetchError || !usuarioAtual?.cpf) {
            console.error("[resetPassword] Erro ao buscar usuário atual ou CPF não encontrado:", fetchError);
            throw new AppError("Usuário ou CPF não encontrado para redefinição de senha.", 404);
        }

        const cpfDigits = onlyNumbers(usuarioAtual.cpf);
        if (cpfDigits.length < 6) {
             throw new AppError("CPF inválido curto demais para gerar a senha.");
        }

        const novaSenha = cpfDigits.substring(0, 6);

        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
            password: novaSenha
        });

        if (authError) {
            console.error("[resetPassword] Falha ao atualizar senha no Auth:", authError);
            throw new AppError("Erro ao redefinir a senha no provedor de autenticação.", 500);
        }

        const { error: dbError } = await supabaseAdmin
            .from("usuarios")
            .update({ senha_padrao: true })
            .eq("id", id);

        if (dbError) {
             console.error("[resetPassword] Falha ao atualizar flag: ", dbError);
             throw new AppError("Senha alterada, mas falhou ao atualizar a flag no banco.", 500);
        }
    },
};