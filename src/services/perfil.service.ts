import { supabaseAdmin } from "../config/supabase.js";
import { PROTECTED_ROLES_NAMES } from "../constants/permissions.enum.js";

export const perfilService = {
    async listPerfis(): Promise<any[]> {
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
            .eq("usuarios.status", "ATIVO")
            .order("nome", { ascending: true });
        if (error) throw error;

        return (data || []).map(p => ({
            ...p,
            total_colaboradores: p.usuarios?.[0]?.count || 0
        }));
    },

    async getPerfil(id: number): Promise<any> {
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
        return data;
    },

    async createPerfil(data: { nome: string, descricao?: string, permissoes?: number[] }): Promise<any> {
        // Formatar o nome e verificar se já existe
        const nomeFormatado = data.nome.toLowerCase().replace(/ /g, '_');

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

    async updatePerfil(id: number, data: { nome?: string, descricao?: string, permissoes?: number[] }): Promise<any> {
        // Buscar o perfil atual para checar se é protegido pelo nome
        const { data: current } = await supabaseAdmin.from("perfis").select("nome").eq("id", id).single();

        // Proteger perfis core de mudar de nome
        if (current && PROTECTED_ROLES_NAMES.includes(current.nome) && data.nome) {
            // Em vez de retornar erro 400 apenas por o frontend ter enviado o próprio nome na request,
            // barramos a alteração se o nome *tentar* ser diferente, ou apenas ignoramos a key de 'nome'.
            if (data.nome !== current.nome) {
                throw new Error("Não é possível alterar o nome de um perfil nativo do sistema.");
            }
            // Se o nome enviado for igual ao atual (como acontece quando o form preenche), não atualiza nada no campo nome.
            delete data.nome;
        }

        const updateData: any = {};
        if (data.nome) updateData.nome = data.nome.toLowerCase().replace(/ /g, '_');
        if (data.descricao !== undefined) updateData.descricao = data.descricao;

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
            throw new Error("Perfis nativos do sistema não podem ser excluídos.");
        }

        const { error } = await supabaseAdmin
            .from("perfis")
            .delete()
            .eq("id", id);

        if (error) throw error;
    },

    async listPermissoes(): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("permissoes")
            .select("*")
            .order("modulo", { ascending: true })
            .order("nome_interno", { ascending: true });
        if (error) throw error;
        return data || [];
    }
};
