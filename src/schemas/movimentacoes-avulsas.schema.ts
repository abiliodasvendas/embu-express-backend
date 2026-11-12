import { z } from "zod";

export const tipoMovimentacaoAvulsaEnum = z.enum([
  "ENTRADA",
  "SAIDA",
]);

export const categoriaMovimentacaoAvulsaEnum = z
  .string()
  .trim()
  .min(1, "Categoria é obrigatória");

export const movimentacaoAvulsaSchema = z.object({
  empresa_id: z.number().int().positive("Empresa é obrigatória"),
  conta_bancaria_id: z.string().uuid("Conta bancária é obrigatória"),
  tipo_movimentacao: tipoMovimentacaoAvulsaEnum,
  categoria: categoriaMovimentacaoAvulsaEnum,
  descricao: z.string().trim().min(1, "Descrição é obrigatória"),
  valor: z.number().positive("Valor deve ser maior que zero"),
  data_movimentacao: z.string().min(1, "Data da movimentação é obrigatória"),
  comprovante_url: z.string().optional().nullable(),
});

export const updateMovimentacaoAvulsaSchema = movimentacaoAvulsaSchema.partial();

export const createTransferenciaContasSchema = z.object({
  conta_origem_id: z.string().uuid("Selecione a conta bancária de origem"),
  conta_destino_id: z.string().uuid("Selecione a conta bancária de destino"),
  valor: z.number().positive("O valor da transferência deve ser maior que zero"),
  data_movimentacao: z.string().min(1, "Data da transferência é obrigatória"),
  descricao: z.string().trim().min(1, "Informe uma descrição para a transferência").optional(),
});

export type CreateTransferenciaContasDTO = z.infer<typeof createTransferenciaContasSchema>;

export const listMovimentacoesAvulsasQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12).optional(),
  ano: z.coerce.number().int().min(2020).optional(),
  empresa_id: z.coerce.number().int().positive().optional(),
  conta_bancaria_id: z.string().uuid().optional(),
  tipo_movimentacao: tipoMovimentacaoAvulsaEnum.optional(),
  categoria: categoriaMovimentacaoAvulsaEnum.optional(),
});
