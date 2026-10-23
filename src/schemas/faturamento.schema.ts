import { z } from "zod";
import { TIPO_PERIODO_FATURA, STATUS_FATURA } from "../constants/financeiro.enum.js";

export const faturaStatusEnum = z.enum([
  STATUS_FATURA.PENDENTE,
  STATUS_FATURA.PAGO_PARCIAL,
  STATUS_FATURA.LIQUIDADA,
  STATUS_FATURA.CANCELADA,
]);

export const tipoPeriodoFaturaEnum = z.enum([
  TIPO_PERIODO_FATURA.QUINZENAL,
  TIPO_PERIODO_FATURA.MENSAL,
  TIPO_PERIODO_FATURA.SEMANAL,
]);

export const faturaClienteSchema = z.object({
  cliente_id: z.number().int().positive("Cliente é obrigatório"),
  empresa_id: z.number().int().positive("Empresa é obrigatória"),
  mes_competencia: z.number().int().min(1).max(12),
  ano_competencia: z.number().int().min(2020),
  quinzena: z.number().int().min(1).max(2).optional().nullable(),
  tipo_periodo: tipoPeriodoFaturaEnum.optional().default(TIPO_PERIODO_FATURA.QUINZENAL),
  numero_periodo: z.number().int().min(1).max(5).optional().default(1),
  data_inicio_apuracao: z.string().optional().nullable(),
  data_fim_apuracao: z.string().optional().nullable(),
  valor_faturado: z.number().nonnegative("Valor faturado deve ser maior ou igual a zero"),
  data_emissao: z.string().optional(),
  data_vencimento: z.string().min(1, "Data de vencimento é obrigatória"),
  status: faturaStatusEnum.optional().default(STATUS_FATURA.PENDENTE),
  dias_esperados: z.number().int().nonnegative().nullable().optional().transform((v) => v ?? 0),
  dias_trabalhados: z.number().int().nonnegative().nullable().optional().transform((v) => v ?? 0),
  faltas_sem_cobertura: z.number().int().nonnegative().nullable().optional().transform((v) => v ?? 0),
  numero_os: z.string().trim().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

export const updateFaturaClienteSchema = faturaClienteSchema.partial();

export const sugestaoMedicaoQuerySchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2020),
  tipo_periodo: tipoPeriodoFaturaEnum.optional(),
  numero_periodo: z.coerce.number().int().min(1).max(5).optional(),
  quinzena: z.coerce.number().int().min(1).max(2).optional(),
});

export const itemRecebimentoSchema = z.object({
  fatura_id: z.string().min(1, "ID da fatura é obrigatório"),
  valor_alocado: z.number().positive("Valor alocado deve ser maior que zero"),
  observacao: z.string().optional().nullable(),
});

export const loteRecebimentoSchema = z.object({
  conta_bancaria_destino_id: z.string().uuid("Conta bancária de destino é obrigatória"),
  data_deposito: z.string().min(1, "Data do depósito é obrigatória"),
  valor_total_depositado: z.number().positive("Valor total depositado deve ser maior que zero"),
  observacao: z.string().optional().nullable(),
  itens: z.array(itemRecebimentoSchema).min(1, "Ao menos uma fatura deve ser selecionada para recebimento"),
});

export const liquidarFaturaIndividualSchema = z
  .object({
    conta_bancaria_id: z.string().uuid("Conta bancária é obrigatória"),
    data_pagamento: z.string().optional(),
    data_recebimento: z.string().optional(),
    valor_pago: z.number().positive("Valor pago deve ser maior que zero"),
    observacao: z.string().optional().nullable(),
  })
  .transform((data) => ({
    conta_bancaria_id: data.conta_bancaria_id,
    data_pagamento:
      data.data_pagamento ||
      data.data_recebimento ||
      new Date().toISOString().split("T")[0],
    valor_pago: data.valor_pago,
    observacao: data.observacao,
  }));

export const acertoIntercompanySchema = z.object({
  transferencia_id: z.string().uuid("ID da transferência intercompany inválido"),
  data_acerto: z.string().min(1, "Data de acerto é obrigatória"),
  comprovante_acerto_url: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
});
