import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../errors/AppError.js";
import { MovimentacaoAvulsa, TipoMovimentacaoAvulsa, CategoriaMovimentacaoAvulsa } from "../types/database.js";
import { z } from "zod";
import { movimentacaoAvulsaSchema, updateMovimentacaoAvulsaSchema } from "../schemas/movimentacoes-avulsas.schema.js";

type CreateMovimentacaoDTO = z.infer<typeof movimentacaoAvulsaSchema>;
type UpdateMovimentacaoDTO = z.infer<typeof updateMovimentacaoAvulsaSchema>;

export const movimentacoesAvulsasService = {
  async list(filtros: {
    mes?: number;
    ano?: number;
    empresa_id?: number;
    conta_bancaria_id?: string;
    tipo_movimentacao?: TipoMovimentacaoAvulsa;
    categoria?: CategoriaMovimentacaoAvulsa;
  }): Promise<MovimentacaoAvulsa[]> {
    let query = supabaseAdmin
      .from("movimentacoes_avulsas")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .order("data_movimentacao", { ascending: false });

    if (filtros.mes) query = query.eq("mes_competencia", filtros.mes);
    if (filtros.ano) query = query.eq("ano_competencia", filtros.ano);
    if (filtros.empresa_id) query = query.eq("empresa_id", filtros.empresa_id);
    if (filtros.conta_bancaria_id) query = query.eq("conta_bancaria_id", filtros.conta_bancaria_id);
    if (filtros.tipo_movimentacao) query = query.eq("tipo_movimentacao", filtros.tipo_movimentacao);
    if (filtros.categoria) query = query.eq("categoria", filtros.categoria);

    const { data, error } = await query;
    if (error) {
      if (error.code === "PGRST205") {
        return [];
      }
      throw error;
    }
    return data || [];
  },

  async getById(id: string): Promise<MovimentacaoAvulsa> {
    const { data, error } = await supabaseAdmin
      .from("movimentacoes_avulsas")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .eq("id", id)
      .single();

    if (error || !data) throw new AppError("Movimentação avulsa não encontrada", 404);
    return data;
  },

  async create(data: CreateMovimentacaoDTO, criadoPor?: string): Promise<MovimentacaoAvulsa> {
    const mesCompetencia = parseInt(data.data_movimentacao.split("-")[1], 10);
    const anoCompetencia = parseInt(data.data_movimentacao.split("-")[0], 10);

    const { data: inserted, error } = await supabaseAdmin
      .from("movimentacoes_avulsas")
      .insert([{
        ...data,
        mes_competencia: mesCompetencia,
        ano_competencia: anoCompetencia,
        criado_por: criadoPor || null,
      }])
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .single();

    if (error) throw error;
    return inserted;
  },

  async update(id: string, data: UpdateMovimentacaoDTO): Promise<MovimentacaoAvulsa> {
    const payload: any = { ...data };
    if (data.data_movimentacao) {
      payload.mes_competencia = parseInt(data.data_movimentacao.split("-")[1], 10);
      payload.ano_competencia = parseInt(data.data_movimentacao.split("-")[0], 10);
    }

    const { data: updated, error } = await supabaseAdmin
      .from("movimentacoes_avulsas")
      .update(payload)
      .eq("id", id)
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .single();

    if (error) throw error;
    return updated;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("movimentacoes_avulsas")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
