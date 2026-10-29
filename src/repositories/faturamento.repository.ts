import { supabaseAdmin } from "../config/supabase.js";
import { FaturaCliente, LoteRecebimento, StatusFatura } from "../types/database.js";

export interface ListFaturasFilters {
  mes?: number;
  ano?: number;
  quinzena?: number;
  tipo_periodo?: string;
  numero_periodo?: number;
  empresa_id?: number;
  cliente_id?: number;
  status?: StatusFatura;
}

export interface ClienteParaMedicao {
  id: number;
  nome_fantasia: string;
  periodicidade?: string | null;
  valor_contrato_mensal?: number | null;
  valor_base?: number | null;
  dia_vencimento_padrao?: number | null;
  empresa_emissora_padrao_id?: number | null;
}

export interface ClienteAtivoContrato {
  id: number;
  nome_fantasia: string;
  ativo: boolean;
  periodicidade?: string | null;
  dia_vencimento_padrao?: number | null;
  empresa_emissora_padrao_id?: number | null;
  valor_contrato_mensal?: number | null;
  valor_base?: number | null;
  created_at: string;
}

export const faturamentoRepository = {
  async listFaturas(filtros: ListFaturasFilters): Promise<FaturaCliente[]> {
    let query = supabaseAdmin
      .from("faturas_clientes")
      .select("*, cliente:clientes(id, nome_fantasia), empresa:empresas(id, nome_fantasia, razao_social, cnpj), recebimentos:fatura_recebimentos(*, conta_bancaria:contas_bancarias(*))")
      .order("data_vencimento", { ascending: false });

    if (filtros.mes) query = query.eq("mes_competencia", filtros.mes);
    if (filtros.ano) query = query.eq("ano_competencia", filtros.ano);
    if (filtros.tipo_periodo) query = query.eq("tipo_periodo", filtros.tipo_periodo);
    if (filtros.numero_periodo) query = query.eq("numero_periodo", filtros.numero_periodo);
    if (filtros.quinzena) query = query.eq("quinzena", filtros.quinzena);
    if (filtros.empresa_id) query = query.eq("empresa_id", filtros.empresa_id);
    if (filtros.cliente_id) query = query.eq("cliente_id", filtros.cliente_id);
    if (filtros.status) query = query.eq("status", filtros.status);

    const { data, error } = await query;
    if (error && error.code !== "PGRST205") throw error;
    return (data || []) as FaturaCliente[];
  },

  async listFaturasAging(filtros: { mes?: number; ano?: number; empresa_id?: number }): Promise<FaturaCliente[]> {
    let query = supabaseAdmin
      .from("faturas_clientes")
      .select("*, cliente:clientes(id, nome_fantasia), empresa:empresas(id, nome_fantasia)")
      .neq("status", "CANCELADA")
      .neq("status", "LIQUIDADA");

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
      .select("*, cliente:clientes(id, nome_fantasia), empresa:empresas(id, nome_fantasia, razao_social, cnpj), recebimentos:fatura_recebimentos(*, conta_bancaria:contas_bancarias(*))")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as FaturaCliente;
  },

  async createFatura(record: Record<string, unknown>): Promise<FaturaCliente> {
    const { data, error } = await supabaseAdmin
      .from("faturas_clientes")
      .insert([record])
      .select("*, cliente:clientes(id, nome_fantasia), empresa:empresas(id, nome_fantasia, razao_social, cnpj), recebimentos:fatura_recebimentos(*, conta_bancaria:contas_bancarias(*))")
      .single();

    if (error) throw error;
    return data as FaturaCliente;
  },

  async updateFatura(id: string, record: Record<string, unknown>): Promise<FaturaCliente> {
    const { data, error } = await supabaseAdmin
      .from("faturas_clientes")
      .update(record)
      .eq("id", id)
      .select("*, cliente:clientes(id, nome_fantasia), empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
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

  async getCliente(id: number): Promise<ClienteParaMedicao | null> {
    const res = await supabaseAdmin
      .from("clientes")
      .select("id, nome_fantasia, periodicidade, valor_contrato_mensal, valor_base, dia_vencimento_padrao, empresa_emissora_padrao_id")
      .eq("id", id)
      .single();

    let clienteData: ClienteParaMedicao | null = res.data ? (res.data as ClienteParaMedicao) : null;
    let clientError = res.error;

    if (clientError && clientError.code === "42703") {
      const fallback = await supabaseAdmin
        .from("clientes")
        .select("id, nome_fantasia, valor_base")
        .eq("id", id)
        .single();
      clienteData = fallback.data
        ? {
            id: fallback.data.id,
            nome_fantasia: fallback.data.nome_fantasia,
            periodicidade: null,
            valor_contrato_mensal: fallback.data.valor_base,
            valor_base: fallback.data.valor_base,
            dia_vencimento_padrao: null,
            empresa_emissora_padrao_id: null,
          }
        : null;
      clientError = fallback.error;
    }

    if (clientError || !clienteData) return null;
    return clienteData;
  },

  async listClientesAtivos(clienteId?: number): Promise<ClienteAtivoContrato[]> {
    let clientQuery = supabaseAdmin
      .from("clientes")
      .select("id, nome_fantasia, ativo, periodicidade, dia_vencimento_padrao, empresa_emissora_padrao_id, valor_contrato_mensal, valor_base, created_at")
      .eq("ativo", true);

    if (clienteId) {
      clientQuery = clientQuery.eq("id", clienteId);
    }

    const { data } = await clientQuery;
    return (data || []) as ClienteAtivoContrato[];
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
};
