import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";
import { supabaseAdmin } from "../config/supabase.js";
import { PROTECTED_ROLES_NAMES } from "../constants/permissions.enum.js";
import { AppError } from "../errors/AppError.js";
import { Perfil, Permissao } from "../types/database.js";
import { slugify } from "../utils/utils.js";
import { perfilSchema, updatePerfilSchema } from "../schemas/perfil.schema.js";
import { z } from "zod";

type CreatePerfilDTO = z.infer<typeof perfilSchema>;
type UpdatePerfilDTO = z.infer<typeof updatePerfilSchema>;

export const perfilService = {
    async listPerfis(): Promise<Perfil[]> {
        const { data, error } = await supabaseAdmin
            .from("perfis")
            .select(`
                *,
                perfil_permissoes(
                    permissao_id,
                    permissao:permissoes(nome_interno, modulo, descricao)
                ),
                usuarios:usuarios(count)
            `)
            .eq("usuarios.status", CADASTRO_STATUS.ATIVO)
            .order("nome", { ascending: true });
        if (error) throw error;

        return (data || []).map(p => {
            const rawUsuarios = p.usuarios as unknown as { count: number }[];
            return {
                ...p,
                total_colaboradores: rawUsuarios?.[0]?.count || 0
            };
        }) as Perfil[];
    },

    async listPublicPerfis(): Promise<Partial<Perfil>[]> {
        const { data, error } = await supabaseAdmin
            .from("perfis")
            .select("id, nome, descricao")
            .order("nome", { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async getPerfil(id: number): Promise<Perfil> {
        const { data, error } = await supabaseAdmin
            .from("perfis")
            .select(`
                *,
                perfil_permissoes(
                    permissao_id,
                    permissao:permissoes(nome_interno, modulo, descricao)
                )
            `)
            .eq("id", id)
            .single();
        if (error) throw error;
        return data as Perfil;
    },

    async createPerfil(data: CreatePerfilDTO): Promise<Perfil> {
        // Formatar o nome e verificar se já existe
        const nomeFormatado = slugify(data.nome);

        // Inserir perfil
        const { data: perfil, error: errorPerfil } = await supabaseAdmin
            .from("perfis")
            .insert([{ nome: nomeFormatado, descricao: data.descricao }])
            .select()
            .single();

        if (errorPerfil) throw errorPerfil;

        // Inserir permissoes se houver
        if (data.permissoes && data.permissoes.length > 0) {
            const permissoesToInsert = data.permissoes.map(pid => ({
                perfil_id: perfil.id,
                permissao_id: pid
            }));

            const { error: errorPermissoes } = await supabaseAdmin
                .from("perfil_permissoes")
                .insert(permissoesToInsert);

            if (errorPermissoes) {
                // Se der erro nas permissões, deleta o perfil para não ficar sujo
                await supabaseAdmin.from("perfis").delete().eq("id", perfil.id);
                throw errorPermissoes;
            }
        }

        return this.getPerfil(perfil.id);
    },

    async updatePerfil(id: number, data: UpdatePerfilDTO): Promise<Perfil> {
        // Buscar o perfil atual para checar se é protegido pelo nome
        const { data: current } = await supabaseAdmin.from("perfis").select("nome").eq("id", id).single();

        // Proteger perfis core de mudar de nome
        if (current && PROTECTED_ROLES_NAMES.includes(current.nome) && data.nome) {
            // Em vez de retornar erro 400 apenas por o frontend ter enviado o próprio nome na request,
            // barramos a alteração se o nome *tentar* ser diferente, ou apenas ignoramos a key de 'nome'.
            if (data.nome !== current.nome) {
                throw new AppError("Não é possível alterar o nome de um perfil nativo do sistema.", 403);
            }
            // Se o nome enviado for igual ao atual (como acontece quando o form preenche), não atualiza nada no campo nome.
            delete data.nome;
        }

        const updateData: Partial<Perfil> = {};
        if (data.nome) updateData.nome = slugify(data.nome);
        if (data.descricao !== undefined) updateData.descricao = data.descricao ?? undefined;

        if (Object.keys(updateData).length > 0) {
            const { error: errorPerfil } = await supabaseAdmin
                .from("perfis")
                .update(updateData)
                .eq("id", id);

            if (errorPerfil) throw errorPerfil;
        }

        // Atualizar permissões (remover todas e adicionar as novas)
        if (data.permissoes !== undefined) {
            const { error: deleteError } = await supabaseAdmin
                .from("perfil_permissoes")
                .delete()
                .eq("perfil_id", id);

            if (deleteError) throw deleteError;

            if (data.permissoes.length > 0) {
                const permissoesToInsert = data.permissoes.map(pid => ({
                    perfil_id: id,
                    permissao_id: pid
                }));

                const { error: insertError } = await supabaseAdmin
                    .from("perfil_permissoes")
                    .insert(permissoesToInsert);

                if (insertError) throw insertError;
            }
        }

        return this.getPerfil(id);
    },

    async deletePerfil(id: number): Promise<void> {
        // Buscar o perfil para checar se é protegido
        const { data: current } = await supabaseAdmin.from("perfis").select("nome").eq("id", id).single();

        // Impedir que perfis nativos sejam deletados
        if (current && PROTECTED_ROLES_NAMES.includes(current.nome)) {
            throw new AppError("Perfis nativos do sistema não podem ser excluídos.", 403);
        }

        const { error } = await supabaseAdmin
            .from("perfis")
            .delete()
            .eq("id", id);

        if (error) throw error;
    },

    async listPermissoes(): Promise<Permissao[]> {
        const { data, error } = await supabaseAdmin
            .from("permissoes")
            .select("*")
            .order("modulo", { ascending: true })
            .order("nome_interno", { ascending: true });
        if (error) throw error;
        return data || [];
    }
};
