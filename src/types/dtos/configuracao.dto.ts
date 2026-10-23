import { z } from "zod";

export const updateConfiguracaoSchema = z.object({
    valor: z.string().min(1, "O valor não pode estar vazio"),
});

export type UpdateConfiguracaoDTO = z.infer<typeof updateConfiguracaoSchema>;

export const configsValidationSchema: Record<string, z.ZodTypeAny> = {
    tolerancia_verde_min: z.string().regex(/^\d+$/, "Deve ser um número inteiro").transform(Number).pipe(z.number().min(0)),
    tolerancia_amarelo_min: z.string().regex(/^\d+$/, "Deve ser um número inteiro").transform(Number).pipe(z.number().min(0)),
    tolerancia_saida_min: z.string().regex(/^\d+$/, "Deve ser um número inteiro").transform(Number).pipe(z.number().min(0)),
    limite_he_excessiva_min: z.string().regex(/^\d+$/, "Deve ser um número inteiro").transform(Number).pipe(z.number().min(0)),
    dia_desembolso_salarios: z.string().regex(/^\d+$/, "Deve ser um número de 1 a 31").transform(Number).pipe(z.number().int().min(1).max(31)),
    dia_desembolso_convenios: z.string().regex(/^\d+$/, "Deve ser um número de 1 a 31").transform(Number).pipe(z.number().int().min(1).max(31)),
    dia_desembolso_vales: z.string().regex(/^\d+$/, "Deve ser um número de 1 a 31").transform(Number).pipe(z.number().int().min(1).max(31)),
};
