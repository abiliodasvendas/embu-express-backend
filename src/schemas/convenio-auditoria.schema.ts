import { z } from "zod";

export const faturaFornecedorConvenioSchema = z.object({
  convenio_id: z.string().uuid("ID do convênio inválido"),
  mes_competencia: z.number().int().min(1).max(12),
  ano_competencia: z.number().int().min(2020),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  valor_total_fatura: z.number().nonnegative("Valor da fatura deve ser positivo"),
  status: z.enum(["PENDENTE", "EM_AUDITORIA", "APROVADA", "PAGA", "GLOSADA"]).default("PENDENTE"),
  comprovante_url: z.string().url().nullable().optional(),
  observacoes: z.string().nullable().optional(),
});

export const updateFaturaFornecedorConvenioSchema = faturaFornecedorConvenioSchema.partial().extend({
  convenio_id: z.string().uuid().optional(),
});

export const updateStatusFaturaFornecedorSchema = z.object({
  status: z.enum(["PENDENTE", "EM_AUDITORIA", "APROVADA", "PAGA", "GLOSADA"]),
  observacoes: z.string().nullable().optional(),
});
