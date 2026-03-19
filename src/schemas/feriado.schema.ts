import { z } from "zod";

export const feriadoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  descricao: z.string().min(3, "Descrição muito curta"),
});

export const updateFeriadoSchema = feriadoSchema.partial();
