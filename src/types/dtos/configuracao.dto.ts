import { z } from "zod";

export const updateConfiguracaoSchema = z.object({
    valor: z.string().min(1, "O valor não pode estar vazio"),
});

export type UpdateConfiguracaoDTO = z.infer<typeof updateConfiguracaoSchema>;

/**
 * Esquemas de validação específicos por chave
 */
export const configsValidationSchema: Record<string, z.ZodTypeAny> = {
    tolerancia_verde_min: z.string().regex(/^\d+$/, "Deve ser um número inteiro").transform(Number).pipe(z.number().min(0)),
    tolerancia_amarelo_min: z.string().regex(/^\d+$/, "Deve ser um número inteiro").transform(Number).pipe(z.number().min(0)),
    tolerancia_saida_min: z.string().regex(/^\d+$/, "Deve ser um número inteiro").transform(Number).pipe(z.number().min(0)),
    limite_he_excessiva_min: z.string().regex(/^\d+$/, "Deve ser um número inteiro").transform(Number).pipe(z.number().min(0)),
};
