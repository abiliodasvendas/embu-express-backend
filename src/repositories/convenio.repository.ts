import { supabaseAdmin } from "../config/supabase.js";
import { Convenio, LancamentoConvenio, BloqueioConvenio } from "../types/database.js";
import { FilterOptions } from "../constants/filters.enum.js";

export const convenioRepository = {
  async list(ativo?: string): Promise<Convenio[]> {
    let query = supabaseAdmin
      .from("convenios")
      .select("*")
      .order("nome", { ascending: true });

    if (ativo !== undefined && ativo !== FilterOptions.TODOS) {
      query = query.eq("ativo", ativo === "true");
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Convenio[];
  },

  async getById(id: string): Promise<Convenio | null> {
    const { data, error } = await supabaseAdmin
      .from("convenios")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as Convenio;
  },

  async getByToken(token: string): Promise<Convenio | null> {
    const { data, error } = await supabaseAdmin
      .from("convenios")
      .select("*")
      .eq("token", token)
      .single();

    if (error || !data) return null;
    return data as Convenio;
  },

  async insert(record: {
    nome: string;
    ativo?: boolean;
    token: string;
    empresa_id?: number | null;
    conta_bancaria_id?: string | null;
  }): Promise<Convenio> {
    const { data, error } = await supabaseAdmin
      .from("convenios")
      .insert(record)
      .select()
      .single();

    if (error) throw error;
    return data as Convenio;
  },

  async update(id: string, record: Partial<Convenio>): Promise<Convenio> {
    const { data, error } = await supabaseAdmin
      .from("convenios")
      .update(record)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Convenio;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("convenios")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async listLancamentosPorPeriodo(
    convenioId: string,
    inicio: string,
    fim: string
  ): Promise<LancamentoConvenio[]> {
    const { data, error } = await supabaseAdmin
      .from("lancamentos_convenios")
      .select("*, colaborador:usuarios(id, nome_completo, cpf)")
      .eq("convenio_id", convenioId)
      .gte("data_lancamento", inicio)
      .lte("data_lancamento", fim)
      .order("data_lancamento", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as LancamentoConvenio[];
  },

  async insertLancamento(record: Record<string, unknown>): Promise<LancamentoConvenio> {
    const { data, error } = await supabaseAdmin
      .from("lancamentos_convenios")
      .insert(record)
      .select("*, colaborador:usuarios(id, nome_completo, cpf)")
      .single();

    if (error) throw error;
    return data as LancamentoConvenio;
  },

  async insertManyLancamentos(records: Array<Record<string, unknown>>): Promise<LancamentoConvenio[]> {
    const { data, error } = await supabaseAdmin
      .from("lancamentos_convenios")
      .insert(records)
      .select("*, colaborador:usuarios(id, nome_completo, cpf)");

    if (error) throw error;
    return (data || []) as LancamentoConvenio[];
  },

  async updateLancamento(
    convenioId: string,
    lancamentoId: string,
    record: Record<string, unknown>
  ): Promise<LancamentoConvenio> {
    const { data, error } = await supabaseAdmin
      .from("lancamentos_convenios")
      .update({ ...record, updated_at: new Date().toISOString() })
      .eq("id", lancamentoId)
      .eq("convenio_id", convenioId)
      .select("*, colaborador:usuarios(id, nome_completo, cpf)")
      .single();

    if (error) throw error;
    return data as LancamentoConvenio;
  },

  async deleteLancamento(convenioId: string, lancamentoId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("lancamentos_convenios")
      .delete()
      .eq("id", lancamentoId)
      .eq("convenio_id", convenioId);

    if (error) throw error;
  },

  async getBloqueiosColaborador(colaboradorId: string): Promise<BloqueioConvenio[]> {
    const { data, error } = await supabaseAdmin
      .from("bloqueios_convenios")
      .select("*, convenio:convenios(id, nome), criado_por_usuario:usuarios!bloqueios_convenios_criado_por_fkey(id, nome_completo)")
      .eq("colaborador_id", colaboradorId);

    if (error) throw error;
    return (data || []) as BloqueioConvenio[];
  },

  async deleteBloqueiosColaborador(colaboradorId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("bloqueios_convenios")
      .delete()
      .eq("colaborador_id", colaboradorId);

    if (error) throw error;
  },

  async insertBloqueios(records: Array<Record<string, unknown>>): Promise<void> {
    const { error } = await supabaseAdmin
      .from("bloqueios_convenios")
      .insert(records);

    if (error) throw error;
  },

  async listTodosBloqueios(): Promise<BloqueioConvenio[]> {
    const { data, error } = await supabaseAdmin
      .from("bloqueios_convenios")
      .select(
        "*, colaborador:usuarios!bloqueios_convenios_colaborador_id_fkey!inner(id, nome_completo, cpf, status), convenio:convenios(id, nome), criado_por_usuario:usuarios!bloqueios_convenios_criado_por_fkey(id, nome_completo)"
      )
      .neq("colaborador.status", "INATIVO")
      .order("criado_em", { ascending: false });

    if (error) throw error;
    return (data || []) as BloqueioConvenio[];
  },

  async getUsuarioStatusEElegibilidade(colaboradorId: string): Promise<{
    id: string;
    status: string;
    valor_mei?: number | null;
    links?: Array<{ data_fim?: string | null; valor_contrato?: number | null }>;
  } | null> {
    const { data, error } = await supabaseAdmin
      .from("usuarios")
      .select("id, status, valor_mei, links:colaborador_cliente(valor_contrato, data_fim)")
      .eq("id", colaboradorId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }
    return data;
  },

  async getPercentualLimiteConvenio(): Promise<number> {
    const { data } = await supabaseAdmin
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "percentual_limite_convenio")
      .single();

    return data?.valor ? parseFloat(data.valor) : 30;
  },

  async listColaboradoresAtivos(): Promise<Array<{ id: string; nome_completo: string }>> {
    const { data, error } = await supabaseAdmin
      .from("usuarios")
      .select("id, nome_completo")
      .eq("status", "ATIVO")
      .order("nome_completo", { ascending: true });

    if (error) throw error;
    return (data || []) as Array<{ id: string; nome_completo: string }>;
  },
};