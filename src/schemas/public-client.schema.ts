import { z } from "zod";

export const publicIdSchema = z.object({
  uuid: z.string().uuid("ID público inválido"),
});

export const controlePontoPublicSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
});

export const espelhoPontoPublicSchema = z.object({
  mes: z.string().transform(Number).pipe(z.number().min(1).max(12)),
  ano: z.string().transform(Number).pipe(z.number().min(2000).max(2100)),
});
