import { z } from "zod";
import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../errors/AppError.js";
import { unidadeSchema, updateUnidadeSchema } from "../schemas/unidade.schema.js";
import { Unidade } from "../types/database.js";
import { cleanString, onlyNumbers } from "../utils/utils.js";

type CreateUnidadeDTO = z.infer<typeof unidadeSchema>;
type UpdateUnidadeDTO = z.infer<typeof updateUnidadeSchema>;

export const unidadeService = {
  async createUnidade(data: CreateUnidadeDTO): Promise<Unidade> {
    const payload = {
      ...data,
      nome_unidade: cleanString(data.nome_unidade),
      razao_social: cleanString(data.razao_social),
      cnpj: onlyNumbers(data.cnpj),
      cep: onlyNumbers(data.cep),
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("unidades_cliente")
      .insert([payload])
      .select()
      .single();

    if (error) {
      if (error.code === '23505' && error.message?.toLowerCase().includes('cnpj')) {
        throw new AppError("CNPJ já cadastrado para outra unidade.", 409);
      }
      throw error;
    }

    return inserted;
  },

  async updateUnidade(id: number, data: UpdateUnidadeDTO): Promise<Unidade> {
    const payload: any = { ...data };
    if (data.nome_unidade) payload.nome_unidade = cleanString(data.nome_unidade);
    if (data.razao_social) payload.razao_social = cleanString(data.razao_social);
    if (data.cnpj) payload.cnpj = onlyNumbers(data.cnpj);
    if (data.cep) payload.cep = onlyNumbers(data.cep);

    const { data: updated, error } = await supabaseAdmin
      .from("unidades_cliente")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' && error.message?.toLowerCase().includes('cnpj')) {
        throw new AppError("CNPJ já cadastrado para outra unidade.", 409);
      }
      throw error;
    }

    return updated;
  },

  async deleteUnidade(id: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from("unidades_cliente")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async getUnidade(id: number): Promise<Unidade> {
    const { data, error } = await supabaseAdmin
      .from("unidades_cliente")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async listUnidadesByCliente(clienteId: number): Promise<Unidade[]> {
    const { data, error } = await supabaseAdmin
      .from("unidades_cliente")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("nome_unidade", { ascending: true });
    if (error) throw error;
    return data || [];
  }
};
