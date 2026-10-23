import { supabaseAdmin } from "../config/supabase.js";
import {
  Convenio,
  FaturaFornecedorConvenio,
  LancamentoConvenio,
} from "../types/database.js";

export const convenioAuditoriaRepository = {
  async getConvenioBasic(
    convenioId: string
  ): Promise<Pick<Convenio, "id" | "nome" | "empresa_id" | "conta_bancaria_id"> | null> {
    const { data, error } = await supabaseAdmin
      .from("convenios")
      .select("id, nome, empresa_id, conta_bancaria_id")
      .eq("id", convenioId)
      .single();

    if (error || !data) return null;
    return data as Pick<Convenio, "id" | "nome" | "empresa_id" | "conta_bancaria_id">;
  },

  async listConveniosParaResumo(): Promise<
    Array<{ id: string; nome: string; ativo: boolean; empresa_id: number | null; conta_bancaria_id: string | null }>
  > {
    const { data, error } = await supabaseAdmin
      .from("convenios")
      .select("id, nome, ativo, empresa_id, conta_bancaria_id")
      .order("nome", { ascending: true });

    if (error) throw error;
    return (data || []) as Array<{
      id: string;
      nome: string;
      ativo: boolean;
      empresa_id: number | null;
      conta_bancaria_id: string | null;
    }>;
  },

  async getFaturaPorCompetencia(
    convenioId: string,
    mes: number,
    ano: number
  ): Promise<FaturaFornecedorConvenio | null> {
    const { data, error } = await supabaseAdmin
      .from("faturas_fornecedores_convenios")
      .select("*")
      .eq("convenio_id", convenioId)
      .eq("mes_competencia", mes)
      .eq("ano_competencia", ano)
      .maybeSingle();

    if (error) throw error;
    return data as FaturaFornecedorConvenio | null;
  },

  async listFaturasPorCompetencia(
    mes: number,
    ano: number
  ): Promise<FaturaFornecedorConvenio[]> {
    const { data, error } = await supabaseAdmin
      .from("faturas_fornecedores_convenios")
      .select("*")
      .eq("mes_competencia", mes)
      .eq("ano_competencia", ano);

    if (error) throw error;
    return (data || []) as FaturaFornecedorConvenio[];
  },

  async insertFatura(record: Record<string, unknown>): Promise<FaturaFornecedorConvenio> {
    const { data, error } = await supabaseAdmin
      .from("faturas_fornecedores_convenios")
      .insert([record])
      .select()
      .single();

    if (error) throw error;
    return data as FaturaFornecedorConvenio;
  },

  async updateFatura(
    id: string,
    record: Record<string, unknown>
  ): Promise<FaturaFornecedorConvenio> {
    const { data, error } = await supabaseAdmin
      .from("faturas_fornecedores_convenios")
      .update(record)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as FaturaFornecedorConvenio;
  },

  async listLancamentosAuditoria(
    convenioId: string,
    dataInicioStr: string,
    dataFimStr: string
  ): Promise<LancamentoConvenio[]> {
    const { data, error } = await supabaseAdmin
      .from("lancamentos_convenios")
      .select("*, colaborador:usuarios(id, nome_completo, cpf)")
      .eq("convenio_id", convenioId)
      .gte("data_lancamento", dataInicioStr)
      .lte("data_lancamento", dataFimStr)
      .order("data_lancamento", { ascending: false });

    if (error) throw error;
    return (data || []) as LancamentoConvenio[];
  },

  async listLancamentosGeraisPeriodo(
    dataInicioStr: string,
    dataFimStr: string
  ): Promise<
    Array<{
      id: string;
      convenio_id: string;
      valor: number;
      moto_embu: boolean;
      colaborador_id: string | null;
      colaborador?: { id: string; nome_completo: string | null } | null;
    }>
  > {
    const { data, error } = await supabaseAdmin
      .from("lancamentos_convenios")
      .select("id, convenio_id, valor, moto_embu, colaborador_id, colaborador:usuarios(id, nome_completo)")
      .gte("data_lancamento", dataInicioStr)
      .lte("data_lancamento", dataFimStr);

    if (error) throw error;
    return (data || []) as unknown as Array<{
      id: string;
      convenio_id: string;
      valor: number;
      moto_embu: boolean;
      colaborador_id: string | null;
      colaborador?: { id: string; nome_completo: string | null } | null;
    }>;
  },
};