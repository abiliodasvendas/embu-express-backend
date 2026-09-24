import { z } from "zod";

export const tipoMovimentacaoAvulsaEnum = z.enum([
  "ENTRADA",
  "SAIDA",
]);

export const categoriaMovimentacaoAvulsaEnum = z.enum([
  "CLIENTE_A_VISTA",
  "RENDIMENTO_APLICACAO",
  "REEMBOLSO",
  "OUTRAS_RECEITAS",
  "OUTRAS_DESPESAS",
]);

export const movimentacaoAvulsaSchema = z.object({
  empresa_id: z.number().int().positive("Empresa é obrigatória"),
  conta_bancaria_id: z.string().uuid("Conta bancária inválida").optional().nullable(),
  tipo_movimentacao: tipoMovimentacaoAvulsaEnum,
  categoria: categoriaMovimentacaoAvulsaEnum,
  descricao: z.string().min(1, "Descrição é obrigatória"),
  valor: z.number().positive("Valor deve ser maior que zero"),
  data_movimentacao: z.string().min(1, "Data da movimentação é obrigatória"),
  comprovante_url: z.string().optional().nullable(),
});

export const updateMovimentacaoAvulsaSchema = movimentacaoAvulsaSchema.partial();

export const listMovimentacoesAvulsasQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12).optional(),
  ano: z.coerce.number().int().min(2020).optional(),
  empresa_id: z.coerce.number().int().positive().optional(),
  conta_bancaria_id: z.string().uuid().optional(),
  tipo_movimentacao: tipoMovimentacaoAvulsaEnum.optional(),
  categoria: categoriaMovimentacaoAvulsaEnum.optional(),
});
