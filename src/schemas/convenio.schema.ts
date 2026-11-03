import { z } from "zod";

export const createConvenioSchema = z.object({
    nome: z.string().min(1, "O nome do convênio é obrigatório."),
    ativo: z.boolean().optional().default(true),
    empresa_id: z.number().int().positive("A empresa pagadora é obrigatória."),
    conta_bancaria_id: z.string().uuid("A conta bancária é obrigatória."),
    dia_vencimento_padrao: z.number().int().min(1, "Dia de vencimento inválido.").max(31, "Dia de vencimento inválido.").optional().nullable(),
    periodicidade: z.enum(['MENSAL', 'QUINZENAL', 'SEMANAL']),
});

export const updateConvenioSchema = createConvenioSchema.partial();

export const lancamentoConvenioSchema = z.object({
    colaborador_id: z.string().uuid("Colaborador inválido."),
    data_lancamento: z.string().min(10, "Data inválida."),
    valor: z.number().positive("O valor deve ser positivo."),
    descricao: z.string().min(1, "A descrição é obrigatória."),
    moto_embu: z.boolean().default(false),
    is_parcelado: z.boolean().optional().default(false),
    quantidade_parcelas: z.number().int().min(2).optional(),
});

export const updateLancamentoConvenioSchema = lancamentoConvenioSchema.partial();

export const salvarBloqueiosColaboradorSchema = z.object({
    bloqueio_geral: z.boolean(),
    convenios_bloqueados_ids: z.array(z.string().uuid("ID de convênio inválido.")).default([]),
    motivo: z.string().nullable().optional()
});

export type SalvarBloqueiosColaboradorDTO = z.infer<typeof salvarBloqueiosColaboradorSchema>;
