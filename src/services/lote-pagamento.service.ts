import { AppError } from "../errors/AppError.js";
import { LotePagamento } from "../types/database.js";
import { z } from "zod";
import { lotePagamentoSchema } from "../schemas/lote-pagamento.schema.js";
import { lotePagamentoRepository } from "../repositories/lote-pagamento.repository.js";
import { despesaRepository } from "../repositories/despesa.repository.js";
import { despesaService } from "./despesa.service.js";
import { convenioAuditoriaRepository } from "../repositories/convenio-auditoria.repository.js";
import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";
import { STATUS_DESPESA, STATUS_FATURA_CONVENIO } from "../constants/financeiro.enum.js";

type LotePagamentoDTO = z.infer<typeof lotePagamentoSchema>;

export const lotePagamentoService = {
  async processarLote(payload: LotePagamentoDTO, criadoPor?: string): Promise<LotePagamento> {
    const { conta_bancaria_origem_id, data_pagamento, valor_total_pago, observacao, itens } = payload;

    const contaBancaria = await contaBancariaRepository.getById(conta_bancaria_origem_id);
    if (!contaBancaria) {
      throw new AppError("Conta bancária de origem não encontrada", 404);
    }

    const somaItens = itens.reduce((acc, item) => acc + item.valor_alocado, 0);
    if (Math.abs(somaItens - valor_total_pago) > 0.05) {
      throw new AppError("A soma dos valores alocados difere do total informado no lote de pagamento", 400);
    }

    const lote = await lotePagamentoRepository.create({
      conta_bancaria_origem_id,
      data_pagamento,
      valor_total_pago,
      observacao: observacao || null,
      criado_por: criadoPor || null,
    });

    for (const item of itens) {
      if (item.tipo === "DESPESA") {
        if (item.id.startsWith("prev_desp_")) {
          await despesaService._materializarPrevisaoDespesa(
            item.id,
            {
              status: "PAGO",
              data_pagamento,
              valor_pago: item.valor_alocado,
              conta_bancaria_id: conta_bancaria_origem_id,
              lote_pagamento_id: lote.id,
            },
            criadoPor
          );
        } else {
          const despesa = await despesaRepository.getById(item.id);
          if (!despesa) {
            throw new AppError(`Despesa ${item.id} não encontrada`, 404);
          }
          await despesaRepository.update(despesa.id, {
            status: STATUS_DESPESA.PAGO,
            data_pagamento,
            valor_pago: item.valor_alocado,
            conta_bancaria_id: conta_bancaria_origem_id,
            lote_pagamento_id: lote.id,
          });
        }
      } else if (item.tipo === "CONVENIO") {
        const faturaConvenio = await convenioAuditoriaRepository.getFaturaById(item.id);
        if (!faturaConvenio) {
          throw new AppError(`Fatura de convênio ${item.id} não encontrada`, 404);
        }

        const novoValorPago = parseFloat((Number(faturaConvenio.valor_pago || 0) + item.valor_alocado).toFixed(2));
        const totalFatura = Number(faturaConvenio.valor_total_fatura || 0);
        const novoStatus = novoValorPago >= totalFatura ? STATUS_FATURA_CONVENIO.PAGA : STATUS_FATURA_CONVENIO.PAGO_PARCIAL;

        await convenioAuditoriaRepository.updateFatura(faturaConvenio.id, {
          status: novoStatus,
          data_pagamento,
          valor_pago: novoValorPago,
          conta_bancaria_id: conta_bancaria_origem_id,
          lote_pagamento_id: lote.id,
        });

        await convenioAuditoriaRepository.createPagamento({
          fatura_fornecedor_id: faturaConvenio.id,
          conta_bancaria_id: conta_bancaria_origem_id,
          empresa_id: contaBancaria.empresa_id || faturaConvenio.empresa_id || null,
          data_pagamento,
          valor_pago: item.valor_alocado,
          observacao: observacao || "Liquidação via lote de pagamentos",
          criado_por: criadoPor || null,
        });
      }
    }

    return lote;
  },

  async listLotes(mes?: number, ano?: number): Promise<LotePagamento[]> {
    return lotePagamentoRepository.list(mes, ano);
  },

  async getLoteById(id: string): Promise<LotePagamento | null> {
    const lote = await lotePagamentoRepository.getById(id);
    if (!lote) throw new AppError("Lote de pagamento não encontrado", 404);
    return lote;
  },
};
