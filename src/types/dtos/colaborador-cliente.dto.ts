import { z } from "zod";
import { ColaboradorCliente } from "../database.js";

export const colaboradorClienteHorarioSchema = z.object({
    dia_semana: z.number().min(0).max(6),
    hora_inicio: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    hora_fim: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    tolerancia_pausa_min: z.number().optional().default(0),
});

export const createVinculoSchema = z.object({
    colaborador_id: z.string().uuid(),
    cliente_id: z.number(),
    unidade_id: z.number(),
    empresa_id: z.number(),
    valor_contrato: z.number().optional().default(0),
    valor_aluguel: z.number().optional().default(0),
    valor_bonus: z.number().optional().default(0),
    ajuda_custo: z.number().optional().default(0),
    valor_adiantamento: z.number().optional().default(0),
    taxa_entrega: z.number().optional().default(0),
    data_inicio: z.string().nullable().optional(),
    horarios: z.array(colaboradorClienteHorarioSchema).optional().default([]),
});

export const updateVinculoSchema = z.object({
    cliente_id: z.number().optional(),
    unidade_id: z.number().optional(),
    empresa_id: z.number().optional(),
    valor_contrato: z.number().optional(),
    valor_aluguel: z.number().optional(),
    valor_bonus: z.number().optional(),
    ajuda_custo: z.number().optional(),
    valor_adiantamento: z.number().optional(),
    taxa_entrega: z.number().optional(),
    data_inicio: z.string().nullable().optional(),
    data_fim: z.string().nullable().optional(),
    horarios: z.array(colaboradorClienteHorarioSchema).optional(),
});

export type CreateVinculoDTO = z.infer<typeof createVinculoSchema>;
export type UpdateVinculoDTO = z.infer<typeof updateVinculoSchema>;

export interface VinculoDTO {
    id: number;
    colaborador_id: string;
    cliente_id: number;
    unidade_id: number;
    empresa_id: number;
    valor_contrato: number;
    valor_aluguel: number;
    valor_bonus: number;
    ajuda_custo: number;
    valor_adiantamento: number;
    taxa_entrega: number;
    data_inicio: string | null;
    data_fim: string | null;
    horarios?: {
        dia_semana: number;
        hora_inicio: string;
        hora_fim: string;
        tolerancia_pausa_min: number;
    }[];
    cliente?: {
        id: number;
        nome_fantasia: string;
    } | null;
    empresa?: {
        id: number;
        nome_fantasia: string;
    } | null;
    unidade?: {
        id: number;
        nome_unidade: string;
    } | null;
}

export function toVinculoDTO(v: ColaboradorCliente): VinculoDTO {
    return {
        id: v.id,
        colaborador_id: v.colaborador_id,
        cliente_id: v.cliente_id,
        unidade_id: v.unidade_id,
        empresa_id: v.empresa_id,
        valor_contrato: Number(v.valor_contrato || 0),
        valor_aluguel: Number(v.valor_aluguel || 0),
        valor_bonus: Number(v.valor_bonus || 0),
        ajuda_custo: Number(v.ajuda_custo || 0),
        valor_adiantamento: Number(v.valor_adiantamento || 0),
        taxa_entrega: Number(v.taxa_entrega || 0),
        data_inicio: v.data_inicio || null,
        data_fim: v.data_fim || null,
        horarios: v.horarios?.map(h => ({
            dia_semana: h.dia_semana,
            hora_inicio: h.hora_inicio,
            hora_fim: h.hora_fim,
            tolerancia_pausa_min: h.tolerancia_pausa_min
        })),
        cliente: v.cliente ? {
            id: v.cliente.id,
            nome_fantasia: v.cliente.nome_fantasia
        } : null,
        empresa: v.empresa ? {
            id: v.empresa.id,
            nome_fantasia: v.empresa.nome_fantasia
        } : null,
        unidade: v.unidade ? {
            id: v.unidade.id,
            nome_unidade: v.unidade.nome_unidade
        } : null
    };
}

export function toVinculoListDTO(links: ColaboradorCliente[]): VinculoDTO[] {
    return (links || []).map(toVinculoDTO);
}
