import { supabaseAdmin } from "../config/supabase.js";
import { Empresa } from "../types/database.js";
import { FilterOptions } from "../constants/filters.enum.js";
import { onlyNumbers } from "../utils/utils.js";

export const empresaRepository = {
  async insert(record: Record<string, unknown>): Promise<Empresa> {
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .insert([record])
      .select()
      .single();

    if (error) throw error;
    return data as Empresa;
  },

  async update(id: number, record: Record<string, unknown>): Promise<Empresa> {
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .update(record)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as Empresa;
  },

  async delete(id: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from("empresas")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async findById(id: number): Promise<Empresa | null> {
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .select("*")
      .eq("id", id)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return (data as Empresa) || null;
  },

  async list(filtros?: { searchTerm?: string; ativo?: string; includeId?: number | string }): Promise<Empresa[]> {
    let query = supabaseAdmin
      .from("empresas")
      .select("*")
      .order("nome_fantasia", { ascending: true });

    if (filtros?.searchTerm) {
      const cleanSearch = onlyNumbers(filtros.searchTerm);
      let orClause = `nome_fantasia.ilike.%${filtros.searchTerm}%,razao_social.ilike.%${filtros.searchTerm}%`;

      if (cleanSearch) {
        orClause += `,cnpj.ilike.%${cleanSearch}%`;
      }

      query = query.or(orClause);
    }

    if (filtros?.ativo !== undefined && filtros.ativo !== FilterOptions.TODOS) {
      if (filtros.includeId) {
        query = query.or(`ativo.eq.${filtros.ativo === "true"},id.eq.${filtros.includeId}`);
      } else {
        query = query.eq("ativo", filtros.ativo === "true");
      }
    } else if (filtros?.includeId) {
      query = query.eq("id", filtros.includeId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []) as Empresa[];
  },
};
