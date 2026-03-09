import { z } from "zod";

export const getExtratoSchema = z.object({
    params: z.object({
        usuarioId: z.string().uuid("ID de usuário inválido"),
    }),
    query: z.object({
        mes: z.string().transform(Number).pipe(z.number().min(1).max(12)),
        ano: z.string().transform(Number).pipe(z.number().min(2000).max(2100)),
    }),
});

export const fecharMesSchema = z.object({
    params: z.object({
        usuarioId: z.string().uuid("ID de usuário inválido"),
    }),
    body: z.object({
        mes: z.number().min(1).max(12),
        ano: z.number().min(2000).max(2100),
    }),
});

export const marcarPagoSchema = z.object({
    params: z.object({
        id: z.string().transform(Number).pipe(z.number()),
    }),
});

export type GetExtratoDTO = z.infer<typeof getExtratoSchema>;
export type FecharMesDTO = z.infer<typeof fecharMesSchema>;
export type MarcarPagoDTO = z.infer<typeof marcarPagoSchema>;
