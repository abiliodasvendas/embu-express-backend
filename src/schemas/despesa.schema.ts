import { z } from "zod";

export const categoriaDespesaEnum = z.enum([
  "DESPESA_FIXA",
  "TRIBUTO_DAS",
  "PARCELAMENTO_FISCAL",
  "INVESTIMENTO_FINANCIAMENTO",
  "DESPESA_FINANCEIRA",
  "PROLABORE",
  "INVESTIMENTO_PATRIMONIAL",
  "CARTAO_CREDITO",
  "DESPESA_ADMINISTRATIVA",
  "DESPESA_FROTA_DOCUMENTO",
]);

export const statusDespesaEnum = z.enum([
  "PENDENTE",
  "ADIADA",
  "PAGO",
  "CANCELADO",
]);

export const despesaOperacionalSchema = z.object({
  empresa_id: z.number().int().positive().optional().nullable(),
  categoria: categoriaDespesaEnum,
  descricao: z.string().min(1, "Descrição é obrigatória"),
  mes_competencia: z.number().int().min(1).max(12),
  ano_competencia: z.number().int().min(2020),
  valor_previsto: z.number().nonnegative("Valor previsto deve ser positivo ou zero"),
  valor_pago: z.number().nonnegative().optional().default(0),
  data_vencimento: z.string().min(1, "Data de vencimento é obrigatória"),
  data_pagamento: z.string().optional().nullable(),
  status: statusDespesaEnum.optional().default("PENDENTE"),
  is_holding: z.boolean().optional().default(false),
});

export const updateDespesaOperacionalSchema = despesaOperacionalSchema.partial();

export const listDespesasQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12).optional(),
  ano: z.coerce.number().int().min(2020).optional(),
  empresa_id: z.coerce.number().int().positive().optional(),
  categoria: categoriaDespesaEnum.optional(),
  status: statusDespesaEnum.optional(),
});
