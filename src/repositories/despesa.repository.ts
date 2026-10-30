import { supabaseAdmin } from "../config/supabase.js";
import { DespesaOperacional, CategoriaDespesa, StatusDespesa } from "../types/database.js";
import { STATUS_DESPESA } from "../constants/financeiro.enum.js";

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
      .neq("status", STATUS_DESPESA.CANCELADO);

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

  async getParcelasAfetadas(grupoId: string, minNumeroParcela?: number): Promise<DespesaOperacional[]> {
    let query = supabaseAdmin
      .from("despesas_operacionais")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .eq("grupo_parcelamento_id", grupoId)
      .neq("status", STATUS_DESPESA.PAGO)
      .order("numero_parcela", { ascending: true });

    if (minNumeroParcela !== undefined) {
      query = query.gte("numero_parcela", minNumeroParcela);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as DespesaOperacional[];
  },

  async deleteByParcelamento(grupoId: string, minNumeroParcela?: number): Promise<void> {
    let query = supabaseAdmin
      .from("despesas_operacionais")
      .delete()
      .eq("grupo_parcelamento_id", grupoId)
      .neq("status", STATUS_DESPESA.PAGO);

    if (minNumeroParcela !== undefined) {
      query = query.gte("numero_parcela", minNumeroParcela);
    }

    const { error } = await query;
    if (error) throw error;
  },

  async getRecorrentesAfetadas(masterId: string, minAno: number, minMes: number): Promise<DespesaOperacional[]> {
    const { data, error } = await supabaseAdmin
      .from("despesas_operacionais")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, tipo_conta)")
      .or(`id.eq.${masterId},recorrencia_origem_id.eq.${masterId}`)
      .neq("status", STATUS_DESPESA.PAGO);

    if (error) throw error;
    const items = (data || []) as DespesaOperacional[];
    return items.filter((item) => item.ano_competencia > minAno || (item.ano_competencia === minAno && item.mes_competencia >= minMes));
  },

  async deleteRecorrenciaFuturas(masterId: string, minAno: number, minMes: number): Promise<void> {
    const { data: afetadas } = await supabaseAdmin
      .from("despesas_operacionais")
      .select("id, mes_competencia, ano_competencia, recorrencia_origem_id")
      .or(`id.eq.${masterId},recorrencia_origem_id.eq.${masterId}`)
      .neq("status", STATUS_DESPESA.PAGO);

    if (!afetadas || afetadas.length === 0) return;

    const idsParaDeletar: string[] = [];
    let cancelarMaster = false;

    for (const d of afetadas) {
      const isFuturaOuAtual = d.ano_competencia > minAno || (d.ano_competencia === minAno && d.mes_competencia >= minMes);
      if (isFuturaOuAtual) {
        if (d.id === masterId) {
          cancelarMaster = true;
        } else {
          idsParaDeletar.push(d.id);
        }
      }
    }

    if (idsParaDeletar.length > 0) {
      const { error: errDel } = await supabaseAdmin
        .from("despesas_operacionais")
        .delete()
        .in("id", idsParaDeletar);
      if (errDel) throw errDel;
    }

    if (cancelarMaster) {
      const { error: errUpdate } = await supabaseAdmin
        .from("despesas_operacionais")
        .update({ status: STATUS_DESPESA.CANCELADO })
        .eq("id", masterId);
      if (errUpdate) throw errUpdate;
    }
  },

  async deleteRecorrenciaTodas(masterId: string): Promise<void> {
    const { error: errFilhos } = await supabaseAdmin
      .from("despesas_operacionais")
      .delete()
      .eq("recorrencia_origem_id", masterId)
      .neq("status", STATUS_DESPESA.PAGO);

    if (errFilhos) throw errFilhos;

    const { error: errMaster } = await supabaseAdmin
      .from("despesas_operacionais")
      .delete()
      .eq("id", masterId)
      .neq("status", STATUS_DESPESA.PAGO);

    if (errMaster) throw errMaster;
  },
};
