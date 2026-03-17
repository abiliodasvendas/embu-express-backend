import { z } from "zod";

export const locationSchema = z.object({
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
  address: z.string().nullable().optional(),
  device: z.string().nullable().optional(),
});

export const createPontoSchema = z.object({
  usuario_id: z.string().uuid("ID do usuário inválido"),
  data_referencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de referência inválida (YYYY-MM-DD)"),
  entrada_hora: z.string().optional(),
  saida_hora: z.string().optional().nullable(),
  entrada_km: z.number().optional().nullable(),
  saida_km: z.number().optional().nullable(),
  cliente_id: z.number().optional().nullable(),
  empresa_id: z.number().optional().nullable(),
  colaborador_cliente_id: z.number().optional().nullable(),
  entrada_loc: locationSchema.optional().nullable(),
  saida_loc: locationSchema.optional().nullable(),
  observacao: z.string().optional().nullable(),
});

export const updatePontoSchema = createPontoSchema.partial();

export const togglePontoSchema = z.object({
  usuario_id: z.string().uuid("ID do usuário inválido"),
  location: locationSchema.optional().nullable(),
  km: z.number().optional().nullable(),
  cliente_id: z.number().optional().nullable(),
  empresa_id: z.number().optional().nullable(),
  colaborador_cliente_id: z.number().optional().nullable(),
});

export const listPontoSchema = z.object({
  data_referencia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  usuario_id: z.string().uuid().optional().or(z.literal("todos")),
  cliente_id: z.string().optional().or(z.literal("todos")),
  incluir_todos: z.string().transform(v => v === "true").optional(),
  searchTerm: z.string().optional(),
});

export const relatorioMensalSchema = z.object({
  usuario_id: z.string().uuid(),
  mes: z.string().transform(Number),
  ano: z.string().transform(Number),
});

export const iniciarPausaSchema = z.object({
  ponto_id: z.number(),
  inicio_hora: z.string().optional(),
  inicio_km: z.number().optional().nullable(),
  inicio_loc: locationSchema.optional().nullable(),
});

export const finalizarPausaSchema = z.object({
  fim_hora: z.string().optional(),
  fim_km: z.number().optional().nullable(),
  fim_loc: locationSchema.optional().nullable(),
});
