import { AppError } from "../errors/AppError.js";
import { FaturaCliente, LoteRecebimento, StatusFatura } from "../types/database.js";
import { faturamentoRepository } from "../repositories/faturamento.repository.js";
import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";
import {
  loteRecebimentoSchema,
  liquidarFaturaIndividualSchema,
} from "../schemas/faturamento.schema.js";
import { z } from "zod";
import {
  STATUS_FATURA,
  STATUS_INTERCOMPANY,
} from "../constants/financeiro.enum.js";

type LoteRecebimentoDTO = z.infer<typeof loteRecebimentoSchema>;
type LiquidarFaturaIndividualDTO = z.infer<typeof liquidarFaturaIndividualSchema>;

export const faturamentoLiquidacaoService = {
  async liquidarFaturaIndividual(
    faturaId: string,
    payload: LiquidarFaturaIndividualDTO,
    materializarPrevisaoFn: (
      prevId: string,
      overrides?: Partial<FaturaCliente>,
      criadoPor?: string
    ) => Promise<FaturaCliente>,
    criadoPor?: string
  ): Promise<FaturaCliente> {
    if (faturaId.startsWith("prev_")) {
      const materializada = await materializarPrevisaoFn(faturaId, undefined, criadoPor);
      faturaId = materializada.id;
    }

    const { conta_bancaria_id, data_pagamento, valor_pago, observacao } = payload;

    const fatura = await faturamentoRepository.getFaturaById(faturaId);
    if (!fatura) {
      throw new AppError("Fatura não encontrada", 404);
    }

    const contaBancaria = await contaBancariaRepository.getById(conta_bancaria_id);
    if (!contaBancaria) {
      throw new AppError("Conta bancária não encontrada", 404);
    }

    const isFaturaSemBaixaAtiva =
      fatura.status === STATUS_FATURA.PENDENTE ||
      fatura.status === STATUS_FATURA.CANCELADA;

    if (isFaturaSemBaixaAtiva) {
      await faturamentoRepository.deleteRecebimentosPorFatura(fatura.id);
    }

    const recebimento = await faturamentoRepository.createRecebimento({
      fatura_id: fatura.id,
      conta_bancaria_id,
      data_recebimento: data_pagamento,
      valor_alocado: valor_pago,
      observacao: observacao || null,
      criado_por: criadoPor || null,
    });

    const valorPagoAtual = isFaturaSemBaixaAtiva ? 0 : Number(fatura.valor_pago || 0);
    const novoValorPago = parseFloat((valorPagoAtual + valor_pago).toFixed(2));
    const valorFaturado = Number(fatura.valor_faturado || 0);
    const novoStatus: StatusFatura =
      novoValorPago >= valorFaturado ? STATUS_FATURA.LIQUIDADA : STATUS_FATURA.PAGO_PARCIAL;

    const faturaAtualizada = await faturamentoRepository.updateFatura(fatura.id, {
      valor_pago: novoValorPago,
      status: novoStatus,
    });

    if (Number(fatura.empresa_id) !== Number(contaBancaria.empresa_id)) {
      await faturamentoRepository.createTransferenciaIntercompany({
        fatura_recebimento_id: recebimento.id,
        empresa_credora_id: fatura.empresa_id,
        empresa_devedora_id: contaBancaria.empresa_id,
        valor: valor_pago,
        data_fato_gerador: data_pagamento,
        status: STATUS_INTERCOMPANY.PENDENTE_ACERTO,
        observacao: `Recebimento da fatura #${fatura.id.substring(0, 8)} recebido na conta do banco ${contaBancaria.banco_nome}`,
      });
    }

    return faturaAtualizada;
  },

  async processarLoteRecebimento(
    payload: LoteRecebimentoDTO,
    materializarPrevisaoFn: (
      prevId: string,
      overrides?: Partial<FaturaCliente>,
      criadoPor?: string
    ) => Promise<FaturaCliente>,
    criadoPor?: string
  ): Promise<LoteRecebimento> {
    const { conta_bancaria_destino_id, data_deposito, valor_total_depositado, observacao, itens } = payload;

    const contaBancaria = await contaBancariaRepository.getById(conta_bancaria_destino_id);
    if (!contaBancaria) {
      throw new AppError("Conta bancária de destino não encontrada", 404);
    }

    const somaItens = itens.reduce((acc, item) => acc + item.valor_alocado, 0);
    if (Math.abs(somaItens - valor_total_depositado) > 0.05) {
      throw new AppError("A soma dos valores alocados difere do total depositado no lote", 400);
    }

    const lote = await faturamentoRepository.createLote({
      conta_bancaria_destino_id,
      data_deposito,
      valor_total_depositado,
      observacao: observacao || null,
      criado_por: criadoPor || null,
    });

    for (const item of itens) {
      if (item.fatura_id.startsWith("prev_")) {
        const materializada = await materializarPrevisaoFn(item.fatura_id, undefined, criadoPor);
        item.fatura_id = materializada.id;
      }

      const fatura = await faturamentoRepository.getFaturaById(item.fatura_id);
      if (!fatura) {
        throw new AppError(`Fatura ${item.fatura_id} não encontrada`, 404);
      }

      const isFaturaSemBaixaAtiva =
        fatura.status === STATUS_FATURA.PENDENTE ||
        fatura.status === STATUS_FATURA.CANCELADA;

      if (isFaturaSemBaixaAtiva) {
        await faturamentoRepository.deleteRecebimentosPorFatura(fatura.id);
      }

      const recebimento = await faturamentoRepository.createRecebimento({
        lote_recebimento_id: lote.id,
        fatura_id: item.fatura_id,
        conta_bancaria_id: conta_bancaria_destino_id,
        data_recebimento: data_deposito,
        valor_alocado: item.valor_alocado,
        observacao: item.observacao || null,
        criado_por: criadoPor || null,
      });

      const valorPagoBase = isFaturaSemBaixaAtiva ? 0 : Number(fatura.valor_pago || 0);
      const novoValorPago = parseFloat((valorPagoBase + item.valor_alocado).toFixed(2));
      const valorFaturadoBase = Number(fatura.valor_faturado || 0);
      const valorFaturadoFinal = Math.max(valorFaturadoBase, novoValorPago);
      const novoStatus: StatusFatura =
        novoValorPago >= valorFaturadoFinal ? STATUS_FATURA.LIQUIDADA : STATUS_FATURA.PAGO_PARCIAL;

      await faturamentoRepository.updateFatura(fatura.id, {
        valor_faturado: valorFaturadoFinal,
        valor_pago: novoValorPago,
        status: novoStatus,
      });

      if (Number(fatura.empresa_id) !== Number(contaBancaria.empresa_id)) {
        await faturamentoRepository.createTransferenciaIntercompany({
          fatura_recebimento_id: recebimento.id,
          empresa_credora_id: fatura.empresa_id,
          empresa_devedora_id: contaBancaria.empresa_id,
          valor: item.valor_alocado,
          data_fato_gerador: data_deposito,
          status: STATUS_INTERCOMPANY.PENDENTE_ACERTO,
          observacao: `Recebimento da fatura ${fatura.id} caiu na conta do banco ${contaBancaria.banco_nome}`,
        });
      }
    }

    return lote;
  },

  async desfazerLiquidacaoFatura(faturaId: string): Promise<FaturaCliente> {
    const fatura = await faturamentoRepository.getFaturaById(faturaId);
    if (!fatura) {
      throw new AppError("Fatura não encontrada", 404);
    }

    await faturamentoRepository.deleteRecebimentosPorFatura(fatura.id);

    return faturamentoRepository.updateFatura(fatura.id, {
      valor_pago: 0,
      status: STATUS_FATURA.PENDENTE,
    });
  },
};
