import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../errors/AppError.js";
import { ContaBancaria } from "../types/database.js";
import { z } from "zod";
import { contaBancariaSchema, updateContaBancariaSchema } from "../schemas/conta-bancaria.schema.js";

type CreateContaBancariaDTO = z.infer<typeof contaBancariaSchema>;
type UpdateContaBancariaDTO = z.infer<typeof updateContaBancariaSchema>;

export const contaBancariaService = {
  async list(empresaId?: number): Promise<ContaBancaria[]> {
    let query = supabaseAdmin
      .from("contas_bancarias")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .order("created_at", { ascending: true });

    if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        return [];
      }
      throw error;
    }
    return data || [];
  },

  async getById(id: string): Promise<ContaBancaria> {
    const { data, error } = await supabaseAdmin
      .from("contas_bancarias")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new AppError("Conta bancária não encontrada", 404);
    }
    return data;
  },

  async create(data: CreateContaBancariaDTO): Promise<ContaBancaria> {
    const { data: inserted, error } = await supabaseAdmin
      .from("contas_bancarias")
      .insert([data])
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .single();

    if (error) throw error;
    return inserted;
  },

  async update(id: string, data: UpdateContaBancariaDTO): Promise<ContaBancaria> {
    const { data: updated, error } = await supabaseAdmin
      .from("contas_bancarias")
      .update(data)
      .eq("id", id)
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .single();

    if (error) throw error;
    return updated;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("contas_bancarias")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};
