import { supabaseAdmin } from "../config/supabase.js";
import { Unidade } from "../types/database.js";

export const unidadeRepository = {
  async insert(record: Partial<Unidade>): Promise<Unidade> {
    const { data, error } = await supabaseAdmin
      .from("unidades_cliente")
      .insert([record])
      .select()
      .single();

    if (error) throw error;
    return data as Unidade;
  },

  async update(id: number, record: Partial<Unidade>): Promise<Unidade> {
    const { data, error } = await supabaseAdmin
      .from("unidades_cliente")
      .update(record)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Unidade;
  },

  async delete(id: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from("unidades_cliente")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async findById(id: number): Promise<Unidade | null> {
    const { data, error } = await supabaseAdmin
      .from("unidades_cliente")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return (data as Unidade) || null;
  },

  async listByCliente(clienteId: number): Promise<Unidade[]> {
    const { data, error } = await supabaseAdmin
      .from("unidades_cliente")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("nome_unidade", { ascending: true });

    if (error) throw error;
    return (data || []) as Unidade[];
  },
};
