import { z } from "zod";
import { onlyNumbers } from "../utils/utils.js";

export const clientSchema = z.object({
  nome_fantasia: z.string().min(1, "Nome fantasia é obrigatório"),
  ativo: z.boolean().optional().default(true),
  tipo_cobranca: z.enum(['FIXO_MENSAL', 'DIARIA_MOTOBOY', 'TAXA_ENTREGA']).optional().default('DIARIA_MOTOBOY'),
  valor_base: z.number().nonnegative().optional().default(0),
  valor_diaria_glosa: z.number().nonnegative().optional().default(0),
  empresa_emissora_padrao_id: z.number().int().positive().nullable().optional(),
});

export const updateClientSchema = clientSchema.partial();

export const listClientSchema = z.object({
  searchTerm: z.string().optional(),
  ativo: z.string().optional(),
  includeId: z.string().optional(),
});
