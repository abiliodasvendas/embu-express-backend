import { z } from "zod";

export const itemPagamentoSchema = z.object({
  id: z.string().uuid("ID inválido"),
  tipo: z.enum(["DESPESA", "CONVENIO"]),
  valor_alocado: z.number().positive("Valor alocado deve ser maior que zero"),
});

export const lotePagamentoSchema = z.object({
  conta_bancaria_origem_id: z.string().uuid("Conta bancária de origem é obrigatória"),
  data_pagamento: z.string().min(1, "Data de pagamento é obrigatória"),
  valor_total_pago: z.number().positive("Valor total pago deve ser maior que zero"),
  observacao: z.string().optional().nullable(),
  itens: z.array(itemPagamentoSchema).min(1, "Ao menos uma conta deve ser selecionada para pagamento"),
});

export const queryContasPagarUnificadasSchema = z.object({
  mes: z.coerce.number().int().min(1).max(12).optional(),
  ano: z.coerce.number().int().min(2020).optional(),
  empresa_id: z.coerce.number().int().positive().optional(),
  status: z.string().optional(),
  busca: z.string().optional(),
});
