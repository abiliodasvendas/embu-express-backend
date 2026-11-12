import { z } from "zod";
import { ESCOPO_CATEGORIA_FINANCEIRA, GRUPO_DRE_CATEGORIA } from "../constants/financeiro.enum.js";

export const escopoCategoriaFinanceiraSchema = z.enum([
  ESCOPO_CATEGORIA_FINANCEIRA.ENTRADA_AVULSA,
  ESCOPO_CATEGORIA_FINANCEIRA.SAIDA_AVULSA,
  ESCOPO_CATEGORIA_FINANCEIRA.DESPESA,
]);

export const grupoDreCategoriaSchema = z.enum([
  GRUPO_DRE_CATEGORIA.RECEITA_OPERACIONAL,
  GRUPO_DRE_CATEGORIA.DESPESA_FIXA,
  GRUPO_DRE_CATEGORIA.TRIBUTO_DAS,
  GRUPO_DRE_CATEGORIA.PROLABORE,
  GRUPO_DRE_CATEGORIA.PARCELAMENTO_FISCAL,
  GRUPO_DRE_CATEGORIA.INVESTIMENTO_FINANCIAMENTO,
  GRUPO_DRE_CATEGORIA.DESPESA_FINANCEIRA,
  GRUPO_DRE_CATEGORIA.NAO_AFETA_DRE,
]);

export const listCategoriasFinanceirasQuerySchema = z.object({
  escopo: escopoCategoriaFinanceiraSchema.optional(),
  apenas_ativas: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

export const createCategoriaFinanceiraSchema = z.object({
  nome: z.string().trim().min(2, "O nome da categoria deve ter ao menos 2 caracteres").max(120),
  escopo: escopoCategoriaFinanceiraSchema,
  grupo_dre: grupoDreCategoriaSchema,
});

export const updateCategoriaFinanceiraSchema = z.object({
  nome: z.string().trim().min(2, "O nome da categoria deve ter ao menos 2 caracteres").max(120).optional(),
  grupo_dre: grupoDreCategoriaSchema.optional(),
  ativo: z.boolean().optional(),
});

export type ListCategoriasFinanceirasQueryDTO = z.infer<typeof listCategoriasFinanceirasQuerySchema>;
export type CreateCategoriaFinanceiraDTO = z.infer<typeof createCategoriaFinanceiraSchema>;
export type UpdateCategoriaFinanceiraDTO = z.infer<typeof updateCategoriaFinanceiraSchema>;
