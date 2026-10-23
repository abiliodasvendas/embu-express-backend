import { z } from "zod";

export const faturaFornecedorConvenioSchema = z.object({
  convenio_id: z.string().uuid("ID do convênio inválido"),
  mes_competencia: z.number().int().min(1).max(12),
  ano_competencia: z.number().int().min(2020),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  valor_total_fatura: z.number().nonnegative("Valor da fatura deve ser positivo"),
  status: z.enum(["PENDENTE", "PAGO_PARCIAL", "PAGA", "CANCELADA"]).default("PENDENTE"),
  empresa_id: z.number().int().positive().nullable().optional(),
  conta_bancaria_id: z.string().uuid().nullable().optional(),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD").nullable().optional(),
  valor_pago: z.number().nonnegative().nullable().optional(),
  comprovante_url: z.string().url().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export const updateFaturaFornecedorConvenioSchema = faturaFornecedorConvenioSchema.partial().extend({
  convenio_id: z.string().uuid().optional(),
});

export const updateStatusFaturaFornecedorSchema = z.object({
  status: z.enum(["PENDENTE", "PAGO_PARCIAL", "PAGA", "CANCELADA"]),
  observacoes: z.string().nullable().optional(),
});

export const liquidarFaturaConvenioSchema = z.object({
  fatura_id: z.string().optional().nullable(),
  convenio_id: z.string().uuid("ID do convênio obrigatório"),
  mes_competencia: z.number().int().min(1).max(12),
  ano_competencia: z.number().int().min(2020),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  valor_total_fatura: z.number().positive("Valor deve ser maior que zero"),
  valor_pago: z.number().positive("Valor pago deve ser maior que zero"),
  data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de pagamento inválida"),
  empresa_id: z.number().int().positive("Empresa pagadora é obrigatória"),
  conta_bancaria_id: z.string().uuid("Conta bancária é obrigatória"),
  observacoes: z.string().optional().nullable(),
});

export type LiquidarFaturaConvenioInput = z.infer<typeof liquidarFaturaConvenioSchema>;
