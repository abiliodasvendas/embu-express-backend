import { supabaseAdmin } from "../config/supabase.js";
import { MovimentacaoAvulsa, TipoMovimentacaoAvulsa, CategoriaMovimentacaoAvulsa } from "../types/database.js";

export interface ListMovimentacoesFilters {
  mes?: number;
  ano?: number;
  empresa_id?: number;
  conta_bancaria_id?: string;
  tipo_movimentacao?: TipoMovimentacaoAvulsa;
  categoria?: CategoriaMovimentacaoAvulsa;
}

export const movimentacaoAvulsaRepository = {
  async list(filtros: ListMovimentacoesFilters): Promise<MovimentacaoAvulsa[]> {
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
    return (data || []) as MovimentacaoAvulsa[];
  },

  async getById(id: string): Promise<MovimentacaoAvulsa | null> {
    const { data, error } = await supabaseAdmin
      .from("movimentacoes_avulsas")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }
    return data as MovimentacaoAvulsa;
  },

  async insert(record: Record<string, unknown>): Promise<MovimentacaoAvulsa> {
    const { data, error } = await supabaseAdmin
      .from("movimentacoes_avulsas")
      .insert([record])
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .single();

    if (error) throw error;
    return data as MovimentacaoAvulsa;
  },

  async update(id: string, record: Record<string, unknown>): Promise<MovimentacaoAvulsa> {
    const { data, error } = await supabaseAdmin
      .from("movimentacoes_avulsas")
      .update(record)
      .eq("id", id)
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .single();

    if (error) throw error;
    return data as MovimentacaoAvulsa;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("movimentacoes_avulsas")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
