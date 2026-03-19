import { z } from "zod";
import { onlyNumbers } from "../utils/utils.js";

export const empresaSchema = z.object({
  nome_fantasia: z.string().min(1, "Nome fantasia é obrigatório"),
  razao_social: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  telefone: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  email: z.string().email("E-mail inválido").optional().nullable(),
  endereco: z.string().optional().nullable(),
  ativo: z.boolean().optional().default(true),
  config: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const updateEmpresaSchema = empresaSchema.partial();

export const listEmpresaSchema = z.object({
  searchTerm: z.string().optional(),
  ativo: z.string().optional(),
  includeId: z.string().optional(),
});
