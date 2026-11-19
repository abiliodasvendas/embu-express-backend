import { z } from "zod";

export const listarAniversariantesQuerySchema = z.object({
    mes: z
        .string()
        .optional()
        .transform((val) => (val ? Number(val) : undefined))
        .refine(
            (val) => val === undefined || (Number.isInteger(val) && val >= 1 && val <= 12),
            "Mês deve ser um número inteiro entre 1 e 12"
        ),
});

export type ListarAniversariantesQuery = z.infer<typeof listarAniversariantesQuerySchema>;
