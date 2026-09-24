import { z } from "zod";

export const fechamentoCaixaMensalSchema = z.object({
  mes: z.number().int().min(1).max(12),
  ano: z.number().int().min(2020),
  saldo_inicial_consolidado: z.number(),
});

export const fluxoCaixaQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2020),
});
