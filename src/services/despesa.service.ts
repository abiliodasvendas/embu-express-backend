import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../errors/AppError.js";
import { DespesaOperacional, CategoriaDespesa, StatusDespesa } from "../types/database.js";
import { z } from "zod";
import { despesaOperacionalSchema, updateDespesaOperacionalSchema } from "../schemas/despesa.schema.js";

type CreateDespesaDTO = z.infer<typeof despesaOperacionalSchema>;
type UpdateDespesaDTO = z.infer<typeof updateDespesaOperacionalSchema>;

export const despesaService = {
  async list(filtros: {
    mes?: number;
    ano?: number;
    empresa_id?: number;
    categoria?: CategoriaDespesa;
    status?: StatusDespesa;
  }): Promise<DespesaOperacional[]> {
    let query = supabaseAdmin
      .from("despesas_operacionais")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .order("data_vencimento", { ascending: true });

    if (filtros.mes) query = query.eq("mes_competencia", filtros.mes);
    if (filtros.ano) query = query.eq("ano_competencia", filtros.ano);
    if (filtros.empresa_id) query = query.eq("empresa_id", filtros.empresa_id);
    if (filtros.categoria) query = query.eq("categoria", filtros.categoria);
    if (filtros.status) query = query.eq("status", filtros.status);

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        return [];
      }
      throw error;
    }
    return data || [];
  },

  async getById(id: string): Promise<DespesaOperacional> {
    const { data, error } = await supabaseAdmin
      .from("despesas_operacionais")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .eq("id", id)
      .single();

    if (error || !data) throw new AppError("Despesa não encontrada", 404);
    return data;
  },

  async create(data: CreateDespesaDTO, criadoPor?: string): Promise<DespesaOperacional> {
    const { data: inserted, error } = await supabaseAdmin
      .from("despesas_operacionais")
      .insert([{
        ...data,
        criado_por: criadoPor || null,
      }])
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .single();

    if (error) throw error;
    return inserted;
  },

  async update(id: string, data: UpdateDespesaDTO): Promise<DespesaOperacional> {
    const { data: updated, error } = await supabaseAdmin
      .from("despesas_operacionais")
      .update(data)
      .eq("id", id)
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .single();

    if (error) throw error;
    return updated;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("despesas_operacionais")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async marcarPaga(id: string, dataPagamento: string, valorPago?: number): Promise<DespesaOperacional> {
    const despesa = await this.getById(id);
    const valor = valorPago !== undefined ? valorPago : despesa.valor_previsto;

    const { data: updated, error } = await supabaseAdmin
      .from("despesas_operacionais")
      .update({
        status: "PAGO",
        data_pagamento: dataPagamento,
        valor_pago: valor,
      })
      .eq("id", id)
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .single();

    if (error) throw error;
    return updated;
  },

  async adiarDespesa(id: string): Promise<DespesaOperacional> {
    const { data: updated, error } = await supabaseAdmin
      .from("despesas_operacionais")
      .update({ status: "ADIADA" })
      .eq("id", id)
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .single();

    if (error) throw error;
    return updated;
  },
};
