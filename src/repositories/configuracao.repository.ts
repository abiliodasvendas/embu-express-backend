import { supabaseAdmin } from "../config/supabase.js";
import { Configuracao } from "../services/configuracao.service.js";

export const configuracaoRepository = {
  async list(): Promise<Configuracao[]> {
    const { data, error } = await supabaseAdmin
      .from("configuracoes_sistema")
      .select("*")
      .order("chave", { ascending: true });
    if (error) throw error;
    return (data || []) as Configuracao[];
  },

  async getByChave(chave: string): Promise<Configuracao | undefined> {
    const { data, error } = await supabaseAdmin
      .from("configuracoes_sistema")
      .select("*")
      .eq("chave", chave.toLowerCase())
      .limit(1);

    if (error) throw error;
    return data?.[0] as Configuracao | undefined;
  },

  async updateByChave(
    chave: string,
    valor: string,
    updatedAt: string
  ): Promise<Configuracao | undefined> {
    const { data, error } = await supabaseAdmin
      .from("configuracoes_sistema")
      .update({ valor, updated_at: updatedAt })
      .eq("chave", chave.toLowerCase())
      .select()
      .limit(1);
    if (error) throw error;
    return data?.[0] as Configuracao | undefined;
  },
};
