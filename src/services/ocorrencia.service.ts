import { logger } from "../config/logger.js";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { toBRTime } from "../utils/utils.js";

function formatOcorrencia(o: any) {
    if (!o) return o;
    const result = { ...o };
    // data_ocorrencia é um campo DATE (sem hora). Deve ser mantido como string pura (YYYY-MM-DD)
    // para evitar que conversões de fuso horário alterem o dia.
    if (result.created_at) result.created_at = toBRTime(result.created_at);
    if (result.updated_at) result.updated_at = toBRTime(result.updated_at);
    return result;
}

export const ocorrenciaService = {
    /**
     * Lista todos os tipos de ocorrência disponíveis.
     */
    async listTiposOcorrencia(): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("tipos_ocorrencia")
            .select("*")
            .order("descricao", { ascending: true });

        if (error) throw error;
        return data || [];
    },

    /**
     * Cria um novo tipo de ocorrência.
     */
    async createTipoOcorrencia(data: any): Promise<any> {
        // Validation: Check for duplicate descriptions (case-insensitive)
        if (data.descricao) {
            const { data: existing } = await supabaseAdmin
                .from("tipos_ocorrencia")
                .select("id")
                .ilike("descricao", data.descricao);

            if (existing && existing.length > 0) {
                throw new Error(messages.ocorrencia.erro.descricaoJaExiste);
            }
        }

        const { id, created_at, updated_at, silent, ...rest } = data;

        const { data: inserted, error } = await supabaseAdmin
            .from("tipos_ocorrencia")
            .insert([rest])
            .select()
            .single();

        if (error) throw error;
        return inserted;
    },

    /**
     * Atualiza um tipo de ocorrência.
     */
    async updateTipoOcorrencia(id: number, data: any): Promise<any> {
        // Validation: Check for duplicate descriptions (ignoring the current one)
        if (data.descricao) {
            const { data: existing } = await supabaseAdmin
                .from("tipos_ocorrencia")
                .select("id")
                .ilike("descricao", data.descricao)
                .neq("id", id);

            if (existing && existing.length > 0) {
                throw new Error(messages.ocorrencia.erro.descricaoJaExiste);
            }
        }

        const { id: _, created_at, updated_at, silent, ...rest } = data;

        const { data: updated, error } = await supabaseAdmin
            .from("tipos_ocorrencia")
            .update(rest)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return updated;
    },

    /**
     * Remove um tipo de ocorrência.
     */
    async deleteTipoOcorrencia(id: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("tipos_ocorrencia")
            .delete()
            .eq("id", id);

        if (error) throw error;
    },

    /**
     * Lista ocorrências com filtros.
     */
    async listOcorrencias(filtros?: {
        usuario_id?: string;
        colaborador_cliente_id?: number;
        data_inicio?: string;
        data_fim?: string;
        order?: string;
        ascending?: boolean;
    }): Promise<any[]> {
        let query = supabaseAdmin
            .from("ocorrencias")
            .select(`
                *,
                tipo:tipos_ocorrencia(id, descricao),
                colaborador:usuarios!fk_ocorrencia_colaborador(id, nome_completo),
                criado_por_usuario:usuarios!fk_ocorrencia_criado_por(id, nome_completo),
                vinculo:colaborador_clientes(id, hora_inicio, hora_fim, cliente:clientes(id, nome_fantasia))
            `);

        // Ordenação padrão: data da ocorrência (desc) e depois data de criação (desc)
        // Isso garante que lançamentos do mesmo dia fiquem na ordem correta de inserção
        query = query
            .order("data_ocorrencia", { ascending: false })
            .order("created_at", { ascending: false });

        if (filtros?.usuario_id) {
            query = query.eq("colaborador_id", filtros.usuario_id);
        }

        if (filtros?.colaborador_cliente_id) {
            query = query.eq("colaborador_cliente_id", filtros.colaborador_cliente_id);
        }

        if (filtros?.data_inicio) {
            query = query.gte("data_ocorrencia", filtros.data_inicio);
        }

        if (filtros?.data_fim) {
            query = query.lte("data_ocorrencia", filtros.data_fim);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(formatOcorrencia);
    },

    /**
     * Cria uma nova ocorrência.
     */
    async createOcorrencia(data: any): Promise<any> {
        logger.info({ data }, "[ocorrenciaService] Criando ocorrência");

        const { id, created_at, updated_at, silent, ...rest } = data;

        const { data: inserted, error } = await supabaseAdmin
            .from("ocorrencias")
            .insert([rest])
            .select()
            .single();

        if (error) throw error;
        return formatOcorrencia(inserted);
    },

    /**
     * Atualiza uma ocorrência.
     */
    async updateOcorrencia(id: number, data: any): Promise<any> {
        logger.info({ id, data }, "[ocorrenciaService] Atualizando ocorrência");
        const { id: _, created_at, updated_at, silent, ...rest } = data;

        const { data: updated, error } = await supabaseAdmin
            .from("ocorrencias")
            .update(rest)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return formatOcorrencia(updated);
    },

    /**
     * Remove uma ocorrência.
     */
    async deleteOcorrencia(id: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("ocorrencias")
            .delete()
            .eq("id", id);

        if (error) throw error;
    }
};
