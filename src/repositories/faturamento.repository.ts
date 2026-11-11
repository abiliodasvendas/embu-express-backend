import { supabaseAdmin } from "../config/supabase.js";
import { FaturaCliente, LoteRecebimento, StatusFatura } from "../types/database.js";
import { STATUS_FATURA } from "../constants/financeiro.enum.js";

export interface ListFaturasFilters {
  mes?: number;
  ano?: number;
  quinzena?: number;
  tipo_periodo?: string;
  numero_periodo?: number;
  empresa_id?: number;
  cliente_id?: number;
  unidade_id?: number;
  status?: StatusFatura;
}

export interface UnidadeParaMedicao {
  id: number;
  cliente_id: number;
  nome_unidade: string;
  cnpj: string;
  periodicidade?: string | null;
  valor_contrato_mensal?: number | null;
  dia_vencimento_padrao?: number | null;
  dia_vencimento_segunda_quinzena?: number | null;
  empresa_emissora_padrao_id?: number | null;
  conta_bancaria_padrao_id?: string | null;
  tipo_cobranca?: string | null;
  cliente?: { id: number; nome_fantasia: string };
}

export interface UnidadeAtivaContrato {
  id: number;
  cliente_id: number;
  nome_unidade: string;
  razao_social: string;
  cnpj: string;
  ativo: boolean;
  periodicidade: string;
  dia_vencimento_padrao: number;
  dia_vencimento_segunda_quinzena?: number | null;
  empresa_emissora_padrao_id?: number | null;
  conta_bancaria_padrao_id?: string | null;
  valor_contrato_mensal: number;
  created_at: string;
  cliente?: { id: number; nome_fantasia: string; ativo: boolean };
}

export const faturamentoRepository = {
  async listFaturas(filtros: ListFaturasFilters): Promise<FaturaCliente[]> {
    let query = supabaseAdmin
      .from("faturas_clientes")
      .select("*, cliente:clientes(id, nome_fantasia), unidade:unidades_cliente(id, nome_unidade, cnpj, valor_contrato_mensal, conta_bancaria_padrao_id), empresa:empresas(id, nome_fantasia, razao_social, cnpj), recebimentos:fatura_recebimentos(*, conta_bancaria:contas_bancarias(*))")
      .order("data_vencimento", { ascending: false });

    if (filtros.mes) query = query.eq("mes_competencia", filtros.mes);
    if (filtros.ano) query = query.eq("ano_competencia", filtros.ano);
    if (filtros.tipo_periodo) query = query.eq("tipo_periodo", filtros.tipo_periodo);
    if (filtros.numero_periodo) query = query.eq("numero_periodo", filtros.numero_periodo);
    if (filtros.quinzena) query = query.eq("quinzena", filtros.quinzena);
    if (filtros.empresa_id) query = query.eq("empresa_id", filtros.empresa_id);
    if (filtros.cliente_id) query = query.eq("cliente_id", filtros.cliente_id);
    if (filtros.unidade_id) query = query.eq("unidade_id", filtros.unidade_id);
    if (filtros.status) query = query.eq("status", filtros.status);

    const { data, error } = await query;
    if (error && error.code !== "PGRST205") throw error;
    return (data || []) as FaturaCliente[];
  },

  async listFaturasAging(filtros: { mes?: number; ano?: number; empresa_id?: number }): Promise<FaturaCliente[]> {
    let query = supabaseAdmin
      .from("faturas_clientes")
      .select("*, cliente:clientes(id, nome_fantasia), unidade:unidades_cliente(id, nome_unidade, cnpj), empresa:empresas(id, nome_fantasia)")
      .neq("status", STATUS_FATURA.CANCELADA)
      .neq("status", STATUS_FATURA.LIQUIDADA);

    if (filtros.mes) query = query.eq("mes_competencia", filtros.mes);
    if (filtros.ano) query = query.eq("ano_competencia", filtros.ano);
    if (filtros.empresa_id) query = query.eq("empresa_id", filtros.empresa_id);

    const { data, error } = await query;
    if (error) {
      if (error.code === "PGRST205") {
        return [];
      }
      throw error;
    }
    return (data || []) as FaturaCliente[];
  },

  async getFaturaById(id: string): Promise<FaturaCliente | null> {
    const { data, error } = await supabaseAdmin
      .from("faturas_clientes")
      .select("*, cliente:clientes(id, nome_fantasia), unidade:unidades_cliente(id, nome_unidade, cnpj, valor_contrato_mensal, conta_bancaria_padrao_id), empresa:empresas(id, nome_fantasia, razao_social, cnpj), recebimentos:fatura_recebimentos(*, conta_bancaria:contas_bancarias(*))")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as FaturaCliente;
  },

  async createFatura(record: Record<string, unknown>): Promise<FaturaCliente> {
    const { data, error } = await supabaseAdmin
      .from("faturas_clientes")
      .insert([record])
      .select("*, cliente:clientes(id, nome_fantasia), unidade:unidades_cliente(id, nome_unidade, cnpj, valor_contrato_mensal, conta_bancaria_padrao_id), empresa:empresas(id, nome_fantasia, razao_social, cnpj), recebimentos:fatura_recebimentos(*, conta_bancaria:contas_bancarias(*))")
      .single();

    if (error) throw error;
    return data as FaturaCliente;
  },

  async updateFatura(id: string, record: Record<string, unknown>): Promise<FaturaCliente> {
    const { data, error } = await supabaseAdmin
      .from("faturas_clientes")
      .update(record)
      .eq("id", id)
      .select("*, cliente:clientes(id, nome_fantasia), unidade:unidades_cliente(id, nome_unidade, cnpj, valor_contrato_mensal, conta_bancaria_padrao_id), empresa:empresas(id, nome_fantasia, razao_social, cnpj), recebimentos:fatura_recebimentos(*, conta_bancaria:contas_bancarias(*))")
      .single();

    if (error) throw error;
    return data as FaturaCliente;
  },

  async deleteFatura(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("faturas_clientes")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async updateFaturasStatusLote(ids: string[], status: StatusFatura): Promise<number> {
    if (ids.length === 0) return 0;
    const payload: Record<string, unknown> = { status };
    if (status === STATUS_FATURA.CANCELADA || status === STATUS_FATURA.PENDENTE) {
      payload.valor_pago = 0;
    }
    const { error, count } = await supabaseAdmin
      .from("faturas_clientes")
      .update(payload, { count: "exact" })
      .in("id", ids);

    if (error) throw error;
    return count ?? ids.length;
  },

  async getUnidadesParaMedicaoLote(unidadeIds: number[]): Promise<UnidadeParaMedicao[]> {
    if (unidadeIds.length === 0) return [];
    const { data, error } = await supabaseAdmin
      .from("unidades_cliente")
      .select("id, cliente_id, nome_unidade, cnpj, periodicidade, valor_contrato_mensal, dia_vencimento_padrao, dia_vencimento_segunda_quinzena, empresa_emissora_padrao_id, conta_bancaria_padrao_id, tipo_cobranca, cliente:clientes(id, nome_fantasia)")
      .in("id", unidadeIds);

    if (error) throw error;
    return (data || []) as unknown as UnidadeParaMedicao[];
  },

  async createFaturasLote(records: Record<string, unknown>[]): Promise<number> {
    if (records.length === 0) return 0;
    const { error, count } = await supabaseAdmin
      .from("faturas_clientes")
      .insert(records, { count: "exact" });

    if (error) throw error;
    return count ?? records.length;
  },

  async getUnidadeParaMedicao(unidadeId: number): Promise<UnidadeParaMedicao | null> {
    const { data, error } = await supabaseAdmin
      .from("unidades_cliente")
      .select("id, cliente_id, nome_unidade, cnpj, periodicidade, valor_contrato_mensal, dia_vencimento_padrao, dia_vencimento_segunda_quinzena, empresa_emissora_padrao_id, conta_bancaria_padrao_id, tipo_cobranca, cliente:clientes(id, nome_fantasia)")
      .eq("id", unidadeId)
      .single();

    if (error || !data) return null;
    return data as unknown as UnidadeParaMedicao;
  },

  async listUnidadesAtivas(clienteId?: number, unidadeId?: number): Promise<UnidadeAtivaContrato[]> {
    let query = supabaseAdmin
      .from("unidades_cliente")
      .select("id, cliente_id, nome_unidade, razao_social, cnpj, ativo, periodicidade, dia_vencimento_padrao, dia_vencimento_segunda_quinzena, empresa_emissora_padrao_id, conta_bancaria_padrao_id, valor_contrato_mensal, created_at, cliente:clientes(id, nome_fantasia, ativo)")
      .eq("ativo", true);

    if (clienteId) {
      query = query.eq("cliente_id", clienteId);
    }
    if (unidadeId) {
      query = query.eq("id", unidadeId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return ((data || []) as unknown as UnidadeAtivaContrato[]).filter(
      (u) => !u.cliente || u.cliente.ativo
    );
  },

  async listEmpresasAtivas(): Promise<Array<{ id: number; nome_fantasia: string; razao_social: string; cnpj: string }>> {
    const { data } = await supabaseAdmin
      .from("empresas")
      .select("id, nome_fantasia, razao_social, cnpj")
      .eq("ativo", true);

    return (data || []) as Array<{ id: number; nome_fantasia: string; razao_social: string; cnpj: string }>;
  },

  async createRecebimento(record: Record<string, unknown>): Promise<{ id: string }> {
    const { data, error } = await supabaseAdmin
      .from("fatura_recebimentos")
      .insert([record])
      .select("id")
      .single();

    if (error) throw error;
    return data;
  },

  async createLote(record: Record<string, unknown>): Promise<LoteRecebimento> {
    const { data, error } = await supabaseAdmin
      .from("lotes_recebimento")
      .insert([record])
      .select()
      .single();

    if (error) throw error;
    return data as LoteRecebimento;
  },

  async createTransferenciaIntercompany(record: Record<string, unknown>): Promise<void> {
    const { error } = await supabaseAdmin
      .from("transferencias_intercompany")
      .insert([record]);

    if (error) throw error;
  },

  async deleteRecebimentosPorFatura(faturaId: string): Promise<void> {
    const { data: recs } = await supabaseAdmin
      .from("fatura_recebimentos")
      .select("id")
      .eq("fatura_id", faturaId);

    const recIds = (recs || []).map((r) => r.id);
    if (recIds.length > 0) {
      await supabaseAdmin
        .from("transferencias_intercompany")
        .delete()
        .in("fatura_recebimento_id", recIds);
    }

    const { error } = await supabaseAdmin
      .from("fatura_recebimentos")
      .delete()
      .eq("fatura_id", faturaId);

    if (error) throw error;
  },

  async deleteRecebimentosPorFaturasLote(faturaIds: string[]): Promise<void> {
    if (faturaIds.length === 0) return;

    const { data: recs } = await supabaseAdmin
      .from("fatura_recebimentos")
      .select("id")
      .in("fatura_id", faturaIds);

    const recIds = (recs || []).map((r) => r.id);
    if (recIds.length > 0) {
      await supabaseAdmin
        .from("transferencias_intercompany")
        .delete()
        .in("fatura_recebimento_id", recIds);
    }

    const { error } = await supabaseAdmin
      .from("fatura_recebimentos")
      .delete()
      .in("fatura_id", faturaIds);

    if (error) throw error;
  },

  async syncValorRecebimentoFatura(faturaId: string, novoValorPago: number): Promise<void> {
    const { data: recs } = await supabaseAdmin
      .from("fatura_recebimentos")
      .select("id, valor_alocado")
      .eq("fatura_id", faturaId)
      .order("created_at", { ascending: true });

    if (!recs || recs.length === 0) {
      if (novoValorPago <= 0) return;

      const fatura = await this.getFaturaById(faturaId);
      if (!fatura) return;

      let contaBancariaId: string | null = fatura.unidade?.conta_bancaria_padrao_id || null;

      if (!contaBancariaId && fatura.empresa_id) {
        const { data: contaEmpresa } = await supabaseAdmin
          .from("contas_bancarias")
          .select("id")
          .eq("empresa_id", fatura.empresa_id)
          .eq("ativo", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        contaBancariaId = contaEmpresa?.id || null;
      }

      if (!contaBancariaId) {
        const { data: contaQualquer } = await supabaseAdmin
          .from("contas_bancarias")
          .select("id")
          .eq("ativo", true)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        contaBancariaId = contaQualquer?.id || null;
      }

      if (!contaBancariaId) return;

      await supabaseAdmin.from("fatura_recebimentos").insert([
        {
          fatura_id: faturaId,
          conta_bancaria_id: contaBancariaId,
          data_recebimento: fatura.data_vencimento || new Date().toISOString().split("T")[0],
          valor_alocado: novoValorPago,
          observacao: "Baixa registrada na edição da fatura",
        },
      ]);
      return;
    }

    if (novoValorPago <= 0) {
      await this.deleteRecebimentosPorFatura(faturaId);
      return;
    }

    const somaAtual = recs.reduce((acc, r) => acc + Number(r.valor_alocado || 0), 0);
    if (Math.abs(somaAtual - novoValorPago) < 0.01) {
      return;
    }

    const principalId = recs[0].id;
    await supabaseAdmin
      .from("fatura_recebimentos")
      .update({ valor_alocado: novoValorPago })
      .eq("id", principalId);

    await supabaseAdmin
      .from("transferencias_intercompany")
      .update({ valor: novoValorPago })
      .eq("fatura_recebimento_id", principalId);

    if (recs.length > 1) {
      const extraIds = recs.slice(1).map((r) => r.id);
      await supabaseAdmin
        .from("transferencias_intercompany")
        .delete()
        .in("fatura_recebimento_id", extraIds);

      await supabaseAdmin
        .from("fatura_recebimentos")
        .delete()
        .in("id", extraIds);
    }
  },
};
