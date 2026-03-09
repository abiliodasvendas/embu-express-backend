import { supabaseAdmin } from "../config/supabase.js";
import { logger } from "../config/logger.js";

export const ocorrenciaService = {
    /**
     * Lista todos os tipos de ocorrência disponíveis.
     */
    async listTiposOcorrencia(): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("tipos_ocorrencia")
            .select("*")
            .order("nome", { ascending: true });

        if (error) throw error;
        return data || [];
    },

    /**
     * Lista ocorrências com filtros.
     */
    async listOcorrencias(filtros?: { usuario_id?: string; colaborador_cliente_id?: number; data_inicio?: string; data_fim?: string }): Promise<any[]> {
        let query = supabaseAdmin
            .from("ocorrencias")
            .select("*, tipo:tipos_ocorrencia(*), colaborador:usuarios!fk_ocorrencia_colaborador(*), criado_por_usuario:usuarios!fk_ocorrencia_criado_por(*), vinculo:colaborador_clientes(*, cliente:clientes(nome_fantasia))")
            .order("data_ocorrencia", { ascending: false });

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
        return data || [];
    },

    /**
     * Cria uma nova ocorrência.
     */
    async createOcorrencia(data: any): Promise<any> {
        logger.info({ data }, "[ocorrenciaService] Criando ocorrência");

        // Regra de Negócio: Impacto financeiro só é possível se houver vínculo com turno
        if (data.impacto_financeiro && !data.colaborador_cliente_id) {
            throw new Error("Lançamentos com impacto financeiro devem estar vinculados a um turno (vínculo).");
        }

        const { data: inserted, error } = await supabaseAdmin
            .from("ocorrencias")
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return inserted;
    },

    /**
     * Atualiza uma ocorrência.
     */
    async updateOcorrencia(id: number, data: any): Promise<any> {
        logger.info({ id, data }, "[ocorrenciaService] Atualizando ocorrência");
        const { data: updated, error } = await supabaseAdmin
            .from("ocorrencias")
            .update(data)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return updated;
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
