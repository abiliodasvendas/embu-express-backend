import { z } from "zod";
import { PERIODICIDADE_FATURAMENTO } from "../constants/financeiro.enum.js";

export const clientSchema = z.object({
  nome_fantasia: z.string().min(1, "Nome fantasia é obrigatório"),
  ativo: z.boolean().optional().default(true),
  tipo_cobranca: z.enum(['FIXO_MENSAL', 'DIARIA_MOTOBOY', 'TAXA_ENTREGA']).optional().default('FIXO_MENSAL'),
  periodicidade: z.enum([
    PERIODICIDADE_FATURAMENTO.QUINZENAL,
    PERIODICIDADE_FATURAMENTO.MENSAL,
    PERIODICIDADE_FATURAMENTO.SEMANAL,
  ]).optional().default(PERIODICIDADE_FATURAMENTO.QUINZENAL),
  dia_vencimento_padrao: z.number().int().min(1).max(31).optional().default(16),
  valor_contrato_mensal: z.number().nonnegative().optional().default(0),
  valor_base: z.number().nonnegative().optional().default(0),
  empresa_emissora_padrao_id: z.number().int().positive().nullable().optional(),
});

export const updateClientSchema = clientSchema.partial();

export const listClientSchema = z.object({
  searchTerm: z.string().optional(),
  ativo: z.string().optional(),
  includeId: z.string().optional(),
});
