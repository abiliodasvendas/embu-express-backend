import { supabaseAdmin } from "../config/supabase.js";

export const dreRepository = {
  async getEmpresaNomeFantasia(empresaId: number): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .select("nome_fantasia")
      .eq("id", empresaId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data?.nome_fantasia || null;
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
