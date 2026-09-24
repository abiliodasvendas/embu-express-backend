import { z } from "zod";

export const faturaStatusEnum = z.enum([
  "EM_MEDICAO",
  "AGUARDANDO_APROVACAO",
  "EMITIDA_PENDENTE",
  "PAGO_PARCIAL",
  "LIQUIDADA",
  "CANCELADA",
]);

export const faturaClienteSchema = z.object({
  cliente_id: z.number().int().positive("Cliente é obrigatório"),
  empresa_id: z.number().int().positive("Empresa é obrigatória"),
  mes_competencia: z.number().int().min(1).max(12),
  ano_competencia: z.number().int().min(2020),
  quinzena: z.number().int().min(1).max(2),
  valor_faturado: z.number().nonnegative("Valor faturado deve ser maior ou igual a zero"),
  data_emissao: z.string().optional(),
  data_vencimento: z.string().min(1, "Data de vencimento é obrigatória"),
  status: faturaStatusEnum.optional().default("EM_MEDICAO"),
  dias_esperados: z.number().int().nonnegative().optional().default(0),
  dias_trabalhados: z.number().int().nonnegative().optional().default(0),
  faltas_sem_cobertura: z.number().int().nonnegative().optional().default(0),
  valor_glosa: z.number().nonnegative().optional().default(0),
  observacoes: z.string().optional().nullable(),
});

export const updateFaturaClienteSchema = faturaClienteSchema.partial();

export const sugestaoMedicaoQuerySchema = z.object({
  cliente_id: z.coerce.number().int().positive(),
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2020),
  quinzena: z.coerce.number().int().min(1).max(2),
});

export const itemRecebimentoSchema = z.object({
  fatura_id: z.string().uuid("ID da fatura inválido"),
  valor_alocado: z.number().positive("Valor alocado deve ser maior que zero"),
  observacao: z.string().optional().nullable(),
});

export const loteRecebimentoSchema = z.object({
  conta_bancaria_destino_id: z.string().uuid("Conta bancária de destino é obrigatória"),
  data_deposito: z.string().min(1, "Data do depósito é obrigatória"),
  valor_total_depositado: z.number().positive("Valor total depositado deve ser maior que zero"),
  comprovante_url: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
  itens: z.array(itemRecebimentoSchema).min(1, "Ao menos uma fatura deve ser selecionada para recebimento"),
});

export const acertoIntercompanySchema = z.object({
  transferencia_id: z.string().uuid("ID da transferência intercompany inválido"),
  data_acerto: z.string().min(1, "Data de acerto é obrigatória"),
  comprovante_acerto_url: z.string().optional().nullable(),
  observacao: z.string().optional().nullable(),
});
