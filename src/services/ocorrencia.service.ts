import { logger } from "../config/logger.js";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { toBRTime } from "../utils/utils.js";
import { AppError } from "../errors/AppError.js";
import { Ocorrencia, TipoOcorrencia } from "../types/database.js";
import {
    ocorrenciaSchema,
    updateOcorrenciaSchema,
    tipoOcorrenciaSchema,
    updateTipoOcorrenciaSchema,
    listOcorrenciaSchema
} from "../schemas/ocorrencia.schema.js";
import { z } from "zod";

type TipoOcorrenciaPayload = z.infer<typeof tipoOcorrenciaSchema>;
type OcorrenciaPayload = z.infer<typeof ocorrenciaSchema>;
type FiltrosOcorrencia = z.infer<typeof listOcorrenciaSchema>;

function formatOcorrencia<T extends { created_at?: string; updated_at?: string }>(o: T): T {
    if (!o) return o;
    const result = { ...o };
    if (result.created_at) result.created_at = toBRTime(result.created_at);
    if (result.updated_at) result.updated_at = toBRTime(result.updated_at);
    return result;
}

export const ocorrenciaService = {
    /**
     * Lista todos os tipos de ocorrência disponíveis.
     */
    async listTiposOcorrencia(): Promise<TipoOcorrencia[]> {
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
    async createTipoOcorrencia(data: TipoOcorrenciaPayload): Promise<TipoOcorrencia> {
        if (data.descricao) {
            const { data: existing } = await supabaseAdmin
                .from("tipos_ocorrencia")
                .select("id")
                .ilike("descricao", data.descricao);

            if (existing && existing.length > 0) {
                throw new AppError(messages.ocorrencia.erro.descricaoJaExiste, 409);
            }
        }

        const { data: inserted, error } = await supabaseAdmin
            .from("tipos_ocorrencia")
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return inserted;
    },

    /**
     * Atualiza um tipo de ocorrência.
     */
    async updateTipoOcorrencia(id: number, data: Partial<TipoOcorrenciaPayload>): Promise<TipoOcorrencia> {
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

        const { data: updated, error } = await supabaseAdmin
            .from("tipos_ocorrencia")
            .update(data)
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
    async listOcorrencias(filtros?: FiltrosOcorrencia): Promise<Ocorrencia[]> {
        let query = supabaseAdmin
            .from("ocorrencias")
            .select(`
                *,
                tipo:tipos_ocorrencia(id, descricao),
                colaborador:usuarios!fk_ocorrencia_colaborador(id, nome_completo),
                criado_por_usuario:usuarios!fk_ocorrencia_criado_por(id, nome_completo),
                vinculo:colaborador_clientes(id, cliente:clientes(id, nome_fantasia))
            `);

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

        if (filtros?.tipo_id) {
            query = query.eq("tipo_id", filtros.tipo_id);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(formatOcorrencia);
    },

    async createOcorrencia(data: OcorrenciaPayload): Promise<Ocorrencia | Ocorrencia[]> {
        logger.info({ data }, "[ocorrenciaService] Criando ocorrência");

        const { is_parcelado, quantidade_parcelas, ...ocorrenciaData } = data;

        if (is_parcelado && quantidade_parcelas && quantidade_parcelas > 1) {
            const ocorrenciasToInsert = [];
            const baseDate = new Date(ocorrenciaData.data_ocorrencia + "T12:00:00Z");

            for (let i = 0; i < quantidade_parcelas; i++) {
                const currentDate = new Date(baseDate);
                const currentMonth = currentDate.getUTCMonth();
                currentDate.setUTCMonth(currentMonth + i);
                
                // Adjust if month overflowed incorrectly (e.g. Jan 31 + 1 month = Mar 3)
                if (currentDate.getUTCMonth() !== ((currentMonth + i) % 12)) {
                    currentDate.setUTCDate(0); // Rollback to last day of previous month
                }
                
                const dataString = currentDate.toISOString().split("T")[0];

                ocorrenciasToInsert.push({
                    ...ocorrenciaData,
                    data_ocorrencia: dataString,
                    observacao: `${ocorrenciaData.observacao} (Parcela ${i + 1}/${quantidade_parcelas})`
                });
            }

            const { data: inserted, error } = await supabaseAdmin
                .from("ocorrencias")
                .insert(ocorrenciasToInsert)
                .select();

            if (error) throw error;
            return inserted.map(formatOcorrencia);
        }

        const { data: inserted, error } = await supabaseAdmin
            .from("ocorrencias")
            .insert([ocorrenciaData])
            .select()
            .single();

        if (error) throw error;
        return formatOcorrencia(inserted);
    },

    /**
     * Atualiza uma ocorrência.
     */
    async updateOcorrencia(id: number, data: Partial<OcorrenciaPayload>): Promise<Ocorrencia> {
        logger.info({ id, data }, "[ocorrenciaService] Atualizando ocorrência");

        // Ignora propriedades virtuais de parcelamento na edição
        const { is_parcelado, quantidade_parcelas, ...updateData } = data;

        const { data: updated, error } = await supabaseAdmin
            .from("ocorrencias")
            .update(updateData)
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
