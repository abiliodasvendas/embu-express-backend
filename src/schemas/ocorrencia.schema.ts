import { z } from "zod";

export const tipoOcorrenciaSchema = z.object({
  descricao: z.string().min(1, "Descrição é obrigatória"),
  impacto_financeiro: z.boolean().optional().default(false),
});

export const updateTipoOcorrenciaSchema = tipoOcorrenciaSchema.partial();

export const ocorrenciaSchema = z.object({
  colaborador_id: z.string().uuid("ID do colaborador inválido"),
  colaborador_cliente_id: z.number().optional().nullable(),
  tipo_id: z.number().int("ID do tipo de ocorrência inválido"),
  data_ocorrencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (YYYY-MM-DD)"),
  valor: z.number().optional().nullable(),
  impacto_financeiro: z.boolean().optional().default(false),
  tipo_lancamento: z.enum(["ENTRADA", "SAIDA"]).optional().default("SAIDA"),
  observacao: z.string().min(1, "Observação é obrigatória"),
  criado_por: z.string().uuid().optional(),
});

export const updateOcorrenciaSchema = ocorrenciaSchema.partial();

export const listOcorrenciaSchema = z.object({
  usuario_id: z.string().uuid().optional(),
  colaborador_cliente_id: z.string().transform(Number).optional(),
  data_inicio: z.string().optional(),
  data_fim: z.string().optional(),
  searchTerm: z.string().optional(),
  tipo_id: z.string().transform(Number).optional(),
});
