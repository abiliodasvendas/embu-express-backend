import { z } from "zod";

export const createConvenioSchema = z.object({
    nome: z.string().min(1, "O nome do convênio é obrigatório."),
    ativo: z.boolean().optional().default(true)
});

export const updateConvenioSchema = z.object({
    nome: z.string().min(1, "O nome do convênio é obrigatório.").optional(),
    ativo: z.boolean().optional()
});

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
