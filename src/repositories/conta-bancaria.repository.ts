import { supabaseAdmin } from "../config/supabase.js";
import { ContaBancaria } from "../types/database.js";
import { z } from "zod";
import { contaBancariaSchema, updateContaBancariaSchema } from "../schemas/conta-bancaria.schema.js";
import { STATUS_DESPESA, STATUS_FATURA, STATUS_FATURA_CONVENIO } from "../constants/financeiro.enum.js";

type CreateContaBancariaDTO = z.infer<typeof contaBancariaSchema>;
type UpdateContaBancariaDTO = z.infer<typeof updateContaBancariaSchema>;

export interface TransacoesParaSaldos {
  recebimentos: Array<{ conta_bancaria_id: string; valor_alocado: number }>;
  movAvulsas: Array<{ conta_bancaria_id: string | null; tipo_movimentacao: string; valor: number }>;
  despesasPagas: Array<{ conta_bancaria_id: string | null; valor_pago: number | null; valor_previsto: number; status: string }>;
  pagamentosConvenios: Array<{ conta_bancaria_id: string | null; valor_pago: number }>;
  adiantamentosPagos: Array<{ conta_bancaria_id: string | null; valor: number | null; colaborador_id: string; mes: number; ano: number }>;
  salariosPagos: Array<{ conta_bancaria_id: string | null; saldo_final: number }>;
  faturasClientesPendentes: Array<{ empresa_id: number; valor_faturado: number; valor_pago: number | null; status: string; mes_competencia?: number | null; ano_competencia?: number | null }>;
  despesasPendentes: Array<{ conta_bancaria_id: string | null; empresa_id: number; valor_previsto: number; valor_pago: number | null; status: string; mes_competencia?: number | null; ano_competencia?: number | null }>;
  conveniosPendentes: Array<{ conta_bancaria_id: string | null; empresa_id: number | null; valor_total_fatura: number; valor_pago: number | null; status: string; mes_competencia?: number | null; ano_competencia?: number | null }>;
}

export const contaBancariaRepository = {
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
      if (error.code === "PGRST205") {
        return [];
      }
      throw error;
    }
    return (data || []) as ContaBancaria[];
  },

  async getById(id: string): Promise<ContaBancaria | null> {
    const { data, error } = await supabaseAdmin
      .from("contas_bancarias")
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }
    return data as ContaBancaria;
  },

  async findDuplicate(
    empresaId: number,
    bancoNome: string,
    agencia?: string | null,
    conta?: string | null,
    excludeId?: string
  ): Promise<ContaBancaria | null> {
    const contaLimpa = conta?.trim();
    if (!contaLimpa) return null;

    let query = supabaseAdmin
      .from("contas_bancarias")
      .select("*")
      .eq("empresa_id", empresaId)
      .ilike("conta", contaLimpa);

    const agenciaLimpa = agencia?.trim();
    if (agenciaLimpa) {
      query = query.ilike("agencia", agenciaLimpa);
    } else {
      query = query.ilike("banco_nome", bancoNome.trim());
    }

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;
    return data as ContaBancaria;
  },

  async create(data: CreateContaBancariaDTO): Promise<ContaBancaria> {
    const { data: inserted, error } = await supabaseAdmin
      .from("contas_bancarias")
      .insert([data])
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .single();

    if (error) throw error;
    return inserted as ContaBancaria;
  },

  async update(id: string, data: UpdateContaBancariaDTO): Promise<ContaBancaria> {
    const { data: updated, error } = await supabaseAdmin
      .from("contas_bancarias")
      .update(data)
      .eq("id", id)
      .select("*, empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .single();

    if (error) throw error;
    return updated as ContaBancaria;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("contas_bancarias")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async getTransacoesParaSaldos(mes?: number, ano?: number): Promise<TransacoesParaSaldos> {
    const [
      recebimentosRes,
      movAvulsasRes,
      despesasPagasRes,
      pagamentosConveniosRes,
      adiantamentosPagosRes,
      salariosPagosRes,
      faturasClientesPendentesRes,
      despesasPendentesRes,
      conveniosPendentesRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("fatura_recebimentos")
        .select("conta_bancaria_id, valor_alocado"),
      supabaseAdmin
        .from("movimentacoes_avulsas")
        .select("conta_bancaria_id, tipo_movimentacao, valor"),
      supabaseAdmin
        .from("despesas_operacionais")
        .select("conta_bancaria_id, valor_pago, valor_previsto, status")
        .neq("status", STATUS_DESPESA.CANCELADO)
        .or(`status.eq.${STATUS_DESPESA.PAGO},valor_pago.gt.0`)
        .not("conta_bancaria_id", "is", null),
      supabaseAdmin
        .from("faturas_fornecedores_pagamentos")
        .select("conta_bancaria_id, valor_pago")
        .not("conta_bancaria_id", "is", null),
      supabaseAdmin
        .from("confirmacoes_adiantamento")
        .select("conta_bancaria_id, valor, colaborador_id, mes, ano")
        .not("conta_bancaria_id", "is", null),
      supabaseAdmin
        .from("fechamentos_financeiros")
        .select("conta_bancaria_id, saldo_final")
        .eq("pago", true)
        .not("conta_bancaria_id", "is", null),
      supabaseAdmin
        .from("faturas_clientes")
        .select("empresa_id, valor_faturado, valor_pago, status, mes_competencia, ano_competencia")
        .neq("status", STATUS_FATURA.LIQUIDADA)
        .neq("status", STATUS_FATURA.CANCELADA),
      supabaseAdmin
        .from("despesas_operacionais")
        .select("conta_bancaria_id, empresa_id, valor_previsto, valor_pago, status, mes_competencia, ano_competencia")
        .neq("status", STATUS_DESPESA.PAGO)
        .neq("status", STATUS_DESPESA.CANCELADO),
      supabaseAdmin
        .from("faturas_fornecedores_convenios")
        .select("conta_bancaria_id, empresa_id, valor_total_fatura, valor_pago, status, mes_competencia, ano_competencia")
        .neq("status", STATUS_FATURA_CONVENIO.PAGA)
        .neq("status", STATUS_FATURA_CONVENIO.CANCELADA),
    ]);

    return {
      recebimentos: recebimentosRes.data || [],
      movAvulsas: movAvulsasRes.data || [],
      despesasPagas: despesasPagasRes.data || [],
      pagamentosConvenios: pagamentosConveniosRes.data || [],
      adiantamentosPagos: adiantamentosPagosRes.data || [],
      salariosPagos: salariosPagosRes.data || [],
      faturasClientesPendentes: faturasClientesPendentesRes.data || [],
      despesasPendentes: despesasPendentesRes.data || [],
      conveniosPendentes: conveniosPendentesRes.data || [],
    };
  },
};
