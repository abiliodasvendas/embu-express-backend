import { z } from "zod";

export const perfilSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  descricao: z.string().optional().nullable(),
  permissoes: z.array(z.number()).optional().default([]),
});

export const updatePerfilSchema = perfilSchema.partial();
