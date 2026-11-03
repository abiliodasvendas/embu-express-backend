import { z } from "zod";
import { onlyNumbers } from "../utils/utils.js";
import { PERIODICIDADE_FATURAMENTO, TIPO_COBRANCA_CLIENTE } from "../constants/financeiro.enum.js";

export const unidadeSchema = z.object({
  cliente_id: z.number().min(1, "ID do cliente é obrigatório"),
  nome_unidade: z.string().min(1, "Nome da unidade é obrigatório"),
  razao_social: z.string().min(1, "Razão social é obrigatória"),
  cnpj: z.string().min(1, "CNPJ é obrigatório").transform(val => onlyNumbers(val)),
  cep: z.string().min(1, "CEP é obrigatório").transform(val => onlyNumbers(val)),
  logradouro: z.string().min(1, "Logradouro é obrigatório"),
  numero: z.string().min(1, "Número é obrigatório"),
  complemento: z.string().optional().nullable(),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  cidade: z.string().min(1, "Cidade é obrigatória"),
  estado: z.string().length(2, "Estado deve ter 2 caracteres"),
  km_contratados: z.number().optional().nullable(),
  escala_semanal: z.array(z.number()).optional().nullable(),
  ativo: z.boolean().optional().default(true),
  valor_contrato_mensal: z.number().nonnegative().optional().default(0),
  periodicidade: z.enum([
    PERIODICIDADE_FATURAMENTO.QUINZENAL,
    PERIODICIDADE_FATURAMENTO.MENSAL,
    PERIODICIDADE_FATURAMENTO.SEMANAL,
  ]).optional().default(PERIODICIDADE_FATURAMENTO.QUINZENAL),
  dia_vencimento_padrao: z.number().int().min(1).max(31).optional().nullable(),
  dia_vencimento_segunda_quinzena: z.number().int().min(1).max(31).optional().nullable(),
  empresa_emissora_padrao_id: z.number().int().positive("A empresa emissora é obrigatória"),
  conta_bancaria_padrao_id: z.string().uuid("A conta bancária é obrigatória"),
  tipo_cobranca: z.string().optional().default(TIPO_COBRANCA_CLIENTE.FIXO_MENSAL),
});

export const updateUnidadeSchema = unidadeSchema.partial().omit({ cliente_id: true });
