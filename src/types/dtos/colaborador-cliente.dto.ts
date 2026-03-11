import { z } from "zod";

export const createVinculoSchema = z.object({
    colaborador_id: z.string().uuid(),
    cliente_id: z.number().nullable().optional(),
    empresa_id: z.number(),
    hora_inicio: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    hora_fim: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    valor_contrato: z.number(),
    valor_aluguel: z.number().optional().default(0),
    valor_bonus: z.number().optional().default(0),
    ajuda_custo: z.number().optional().default(0),
    valor_mei: z.number().optional().default(0),
    valor_adiantamento: z.number().optional().default(0),
    data_inicio: z.string().nullable().optional(),
    data_fim: z.string().nullable().optional(),
});

export const updateVinculoSchema = createVinculoSchema.partial().omit({ colaborador_id: true });

export type CreateVinculoDTO = z.infer<typeof createVinculoSchema>;
export type UpdateVinculoDTO = z.infer<typeof updateVinculoSchema>;
