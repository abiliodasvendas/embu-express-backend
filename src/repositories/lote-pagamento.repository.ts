import { supabaseAdmin } from "../config/supabase.js";
import { LotePagamento } from "../types/database.js";

export const lotePagamentoRepository = {
  async create(record: Record<string, unknown>): Promise<LotePagamento> {
    const { data, error } = await supabaseAdmin
      .from("lotes_pagamento")
      .insert([record])
      .select("*, conta_bancaria_origem:contas_bancarias(*)")
      .single();

    if (error) throw error;
    return data as LotePagamento;
  },

  async getById(id: string): Promise<LotePagamento | null> {
    const { data, error } = await supabaseAdmin
      .from("lotes_pagamento")
      .select("*, conta_bancaria_origem:contas_bancarias(*)")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return data as LotePagamento;
  },

  async list(mes?: number, ano?: number): Promise<LotePagamento[]> {
    let query = supabaseAdmin
      .from("lotes_pagamento")
      .select("*, conta_bancaria_origem:contas_bancarias(*)")
      .order("data_pagamento", { ascending: false });

    if (ano && mes) {
      const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
      const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
      const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
      query = query.gte("data_pagamento", inicio).lte("data_pagamento", fim);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data || []) as LotePagamento[];
  },
};
