import { z } from "zod";

export const clientSchema = z.object({
  nome_fantasia: z.string().min(1, "Nome fantasia é obrigatório"),
  razao_social: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  telefone: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido").optional().nullable(),
  endereco: z.string().optional().nullable(),
  ativo: z.boolean().optional().default(true),
  escala_semanal: z.array(z.number()).optional().nullable(),
  valor_saida_base: z.number().optional().nullable(),
  tolerancia_pausa_min: z.number().optional().nullable(),
});

export const updateClientSchema = clientSchema.partial();

export const listClientSchema = z.object({
  searchTerm: z.string().optional(),
  ativo: z.string().optional(),
  includeId: z.string().optional(),
});
