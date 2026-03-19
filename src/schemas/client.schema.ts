import { z } from "zod";
import { onlyNumbers } from "../utils/utils.js";

export const clientSchema = z.object({
  nome_fantasia: z.string().min(1, "Nome fantasia é obrigatório"),
  ativo: z.boolean().optional().default(true),
});

export const updateClientSchema = clientSchema.partial();

export const listClientSchema = z.object({
  searchTerm: z.string().optional(),
  ativo: z.string().optional(),
  includeId: z.string().optional(),
});
