import { logger } from "../config/logger.js";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { toBRTime } from "../utils/utils.js";
import { AppError } from "../errors/AppError.js";

// Interfaces
export interface TipoOcorrenciaPayload {
    id?: number;
    descricao: string;
    impacto_financeiro?: boolean;
    valor_padrao?: number | null;
}

export interface OcorrenciaPayload {
    id?: number;
    colaborador_id: string;
    colaborador_cliente_id?: number | null;
    tipo_id: number;
    data_ocorrencia: string;
    valor?: number | null;
    impacto_financeiro?: boolean;
    tipo_lancamento?: 'ENTRADA' | 'SAIDA';
    observacao?: string | null;
    criado_por?: string;
}

export interface FiltrosOcorrencia {
    usuario_id?: string;
    colaborador_cliente_id?: number;
    data_inicio?: string;
    data_fim?: string;
    order?: string;
    ascending?: boolean;
}

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
    async createTipoOcorrencia(data: TipoOcorrenciaPayload): Promise<any> {
        // Validation: Check for duplicate descriptions (case-insensitive)
        if (data.descricao) {
            const { data: existing } = await supabaseAdmin
                .from("tipos_ocorrencia")
                .select("id")
                .ilike("descricao", data.descricao);

            if (existing && existing.length > 0) {
                throw new AppError(messages.ocorrencia.erro.descricaoJaExiste, 409);
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created_at, updated_at, ...rest } = data as any;

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
    async updateTipoOcorrencia(id: number, data: Partial<TipoOcorrenciaPayload>): Promise<any> {
        // Validation: Check for duplicate descriptions (ignoring the current one)
        if (data.descricao) {
            const { data: existing } = await supabaseAdmin
                .from("tipos_ocorrencia")
                .select("id")
                .ilike("descricao", data.descricao)
                .neq("id", id);

            if (existing && existing.length > 0) {
                throw new AppError(messages.ocorrencia.erro.descricaoJaExiste, 409);
            }
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _, created_at, updated_at, ...rest } = data as any;

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
    async listOcorrencias(filtros?: FiltrosOcorrencia): Promise<any[]> {
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
    async createOcorrencia(data: OcorrenciaPayload): Promise<any> {
        logger.info({ data }, "[ocorrenciaService] Criando ocorrência");

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created_at, updated_at, ...rest } = data as any;

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
    async updateOcorrencia(id: number, data: Partial<OcorrenciaPayload>): Promise<any> {
        logger.info({ id, data }, "[ocorrenciaService] Atualizando ocorrência");
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _, created_at, updated_at, ...rest } = data as any;

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
