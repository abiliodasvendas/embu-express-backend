import { z } from "zod";

export const contaBancariaSchema = z.object({
  empresa_id: z.number().int().positive("Empresa é obrigatória"),
  banco_nome: z.string().min(1, "Nome do banco é obrigatório"),
  agencia: z.string().optional().nullable(),
  conta: z.string().optional().nullable(),
  tipo_conta: z.string().optional().default("CORRENTE"),
  ativo: z.boolean().optional().default(true),
});

export const updateContaBancariaSchema = contaBancariaSchema.partial();
