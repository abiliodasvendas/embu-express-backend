import { supabaseAdmin } from "../config/supabase.js";

export const fluxoCaixaRepository = {
  async getFechamentoCaixa(mes: number, ano: number) {
    const { data, error } = await supabaseAdmin
      .from("fechamentos_caixa_mensal")
      .select("saldo_inicial_consolidado")
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsertFechamentoCaixa(record: {
    mes: number;
    ano: number;
    saldo_inicial_consolidado: number;
    fechado_por?: string | null;
  }) {
    const { data, error } = await supabaseAdmin
      .from("fechamentos_caixa_mensal")
      .upsert(record, { onConflict: "mes,ano" })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async listConfirmacoesAdiantamento(mes: number, ano: number) {
    const { data, error } = await supabaseAdmin
      .from("confirmacoes_adiantamento")
      .select("colaborador_id, valor")
      .eq("mes", mes)
      .eq("ano", ano);

    if (error) throw error;
    return data || [];
  },

  async listColaboradorClientesAtivos() {
    const { data, error } = await supabaseAdmin
      .from("colaborador_clientes")
      .select("colaborador_id, valor_adiantamento")
      .is("data_fim", null);

    if (error) throw error;
    return data || [];
  },

  async listMovimentacoesAvulsasPeriodo(mes: number, ano: number) {
    const { data, error } = await supabaseAdmin
      .from("movimentacoes_avulsas")
      .select("*")
      .eq("mes_competencia", mes)
      .eq("ano_competencia", ano);

    if (error) throw error;
    return data || [];
  },
};
