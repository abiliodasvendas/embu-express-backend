import { supabaseAdmin } from "../config/supabase.js";
import { DespesaOperacional, CategoriaDespesa, StatusDespesa } from "../types/database.js";

export interface ListDespesasFilters {
  mes?: number;
  ano?: number;
  empresa_id?: number;
  categoria?: CategoriaDespesa;
  status?: StatusDespesa;
}

export const despesaRepository = {
  async list(filtros: ListDespesasFilters): Promise<DespesaOperacional[]> {
    let query = supabaseAdmin
      .from("despesas_operacionais")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .order("data_vencimento", { ascending: true });

    if (filtros.mes) query = query.eq("mes_competencia", filtros.mes);
    if (filtros.ano) query = query.eq("ano_competencia", filtros.ano);
    if (filtros.empresa_id) query = query.eq("empresa_id", filtros.empresa_id);
    if (filtros.categoria) query = query.eq("categoria", filtros.categoria);
    if (filtros.status) query = query.eq("status", filtros.status);

    const { data, error } = await query;
    if (error) {
      if (error.code === "PGRST205") {
        return [];
      }
      throw error;
    }
    return (data || []) as DespesaOperacional[];
  },

  async listRecorrentesAtivas(empresaId?: number, categoria?: CategoriaDespesa): Promise<DespesaOperacional[]> {
    let query = supabaseAdmin
      .from("despesas_operacionais")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .eq("is_recorrente", true)
      .neq("status", "CANCELADO");

    if (empresaId) query = query.eq("empresa_id", empresaId);
    if (categoria) query = query.eq("categoria", categoria);

    const { data, error } = await query;
    if (error) {
      return [];
    }
    return (data || []) as DespesaOperacional[];
  },

  async getById(id: string): Promise<DespesaOperacional | null> {
    const { data, error } = await supabaseAdmin
      .from("despesas_operacionais")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }
    return data as DespesaOperacional;
  },

  async insert(record: Record<string, unknown>): Promise<DespesaOperacional> {
    const { data, error } = await supabaseAdmin
      .from("despesas_operacionais")
      .insert([record])
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .single();

    if (error) throw error;
    return data as DespesaOperacional;
  },

  async insertMany(records: Array<Record<string, unknown>>): Promise<DespesaOperacional[]> {
    const { data, error } = await supabaseAdmin
      .from("despesas_operacionais")
      .insert(records)
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)");

    if (error) throw error;
    return (data || []) as DespesaOperacional[];
  },

  async update(id: string, record: Record<string, unknown>): Promise<DespesaOperacional> {
    const { data, error } = await supabaseAdmin
      .from("despesas_operacionais")
      .update(record)
      .eq("id", id)
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .single();

    if (error) throw error;
    return data as DespesaOperacional;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("despesas_operacionais")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
