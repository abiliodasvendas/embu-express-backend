import { z } from "zod";

export const alocacaoTemporariaSchema = z.object({
  reserva_id: z.string().uuid("ID do reserva inválido"),
  titular_ausente_id: z.string().uuid("ID do titular inválido").optional().nullable(),
  cliente_id: z.number().int().positive("Cliente é obrigatório"),
  unidade_id: z.number().int().positive().optional().nullable(),
  data_cobertura: z.string().min(1, "Data de cobertura é obrigatória"),
  observacao: z.string().optional().nullable(),
});

export const retaguardaQuerySchema = z.object({
  mes: z.coerce.number().int().min(1).max(12),
  ano: z.coerce.number().int().min(2020),
});
