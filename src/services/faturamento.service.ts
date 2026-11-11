import { AppError } from "../errors/AppError.js";
import { FaturaCliente, LoteRecebimento, AgingRecebiveisResultado } from "../types/database.js";
import { faturamentoRepository, ListFaturasFilters } from "../repositories/faturamento.repository.js";
import {
  faturaClienteSchema,
  updateFaturaClienteSchema,
  loteRecebimentoSchema,
  liquidarFaturaIndividualSchema,
} from "../schemas/faturamento.schema.js";
import { z } from "zod";
import { STATUS_FATURA } from "../constants/financeiro.enum.js";
import {
  calcularValoresSugestaoMedicao,
  gerarProjecoesVirtuais,
  montarPayloadMaterializacao,
  montarPayloadsCancelamentoPrevisoes,
} from "../utils/faturamento-projecao.helper.js";
import { calcularAgingRecebiveis } from "../utils/faturamento-aging.helper.js";
import { faturamentoLiquidacaoService } from "./faturamento-liquidacao.service.js";

type CreateFaturaDTO = z.infer<typeof faturaClienteSchema>;
type UpdateFaturaDTO = z.infer<typeof updateFaturaClienteSchema>;
type LoteRecebimentoDTO = z.infer<typeof loteRecebimentoSchema>;
type LiquidarFaturaIndividualDTO = z.infer<typeof liquidarFaturaIndividualSchema>;

export const faturamentoService = {
  async calcularSugestaoMedicao(params: {
    unidadeId?: number;
    clienteId?: number;
    mes: number;
    ano: number;
    tipoPeriodo?: string;
    numeroPeriodo?: number;
    quinzena?: number | null;
  }) {
    let targetUnidadeId = params.unidadeId;

    if (!targetUnidadeId && params.clienteId) {
      const unidades = await faturamentoRepository.listUnidadesAtivas(params.clienteId);
      if (unidades.length > 0) {
        targetUnidadeId = unidades[0].id;
      }
    }

    if (!targetUnidadeId) {
      throw new AppError("Unidade não informada", 400);
    }

    const unidade = await faturamentoRepository.getUnidadeParaMedicao(targetUnidadeId);
    if (!unidade) {
      throw new AppError("Unidade não encontrada", 404);
    }

    return calcularValoresSugestaoMedicao({
      unidade,
      mes: params.mes,
      ano: params.ano,
      tipoPeriodo: params.tipoPeriodo,
      numeroPeriodo: params.numeroPeriodo,
      quinzena: params.quinzena,
    });
  },

  async _materializarPrevisao(
    prevId: string,
    overrides?: Partial<FaturaCliente>,
    criadoPor?: string
  ): Promise<FaturaCliente> {
    const parts = prevId.split("_");
    const unidadeId = Number(parts[1]);
    const mes = Number(parts[2]);
    const ano = Number(parts[3]);
    const numPeriodo = Number(parts[4]);

    const unidade = await faturamentoRepository.getUnidadeParaMedicao(unidadeId);
    if (!unidade) {
      throw new AppError("Unidade da previsão não encontrada", 404);
    }

    const empresas = await faturamentoRepository.listEmpresasAtivas();
    const fallbackEmpresa = empresas[0] || { id: 1 };
    const empresaId = unidade.empresa_emissora_padrao_id || fallbackEmpresa.id;

    const record = montarPayloadMaterializacao(
      unidade,
      mes,
      ano,
      numPeriodo,
      empresaId,
      overrides,
      criadoPor
    );

    return faturamentoRepository.createFatura(record);
  },

  async listFaturas(filtros: ListFaturasFilters): Promise<FaturaCliente[]> {
    const mes = filtros.mes;
    const ano = filtros.ano;
    const shouldFetchPrevisoes = Boolean(
      mes &&
      ano &&
      (!filtros.status || filtros.status === STATUS_FATURA.PENDENTE)
    );

    const [faturasReais, unidades, empresas] = await Promise.all([
      faturamentoRepository.listFaturas(filtros),
      shouldFetchPrevisoes
        ? faturamentoRepository.listUnidadesAtivas(filtros.cliente_id, filtros.unidade_id)
        : Promise.resolve([]),
      shouldFetchPrevisoes ? faturamentoRepository.listEmpresasAtivas() : Promise.resolve([]),
    ]);

    if (!shouldFetchPrevisoes || !mes || !ano || unidades.length === 0) {
      return faturasReais;
    }

    const projecoes = gerarProjecoesVirtuais(unidades, faturasReais, empresas, filtros, mes, ano);
    const resultado = [...faturasReais, ...projecoes];
    resultado.sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento));
    return resultado;
  },

  async getFaturaById(id: string): Promise<FaturaCliente> {
    if (id.startsWith("prev_")) {
      return this._materializarPrevisao(id);
    }
    const data = await faturamentoRepository.getFaturaById(id);
    if (!data) throw new AppError("Fatura não encontrada", 404);
    return data;
  },

  async createFatura(data: CreateFaturaDTO, criadoPor?: string): Promise<FaturaCliente> {
    const isLiquidadaOuParcial =
      data.status === STATUS_FATURA.LIQUIDADA ||
      data.status === STATUS_FATURA.PAGO_PARCIAL;
    const valorPagoInicial = isLiquidadaOuParcial
      ? data.valor_pago && data.valor_pago > 0
        ? data.valor_pago
        : data.status === STATUS_FATURA.LIQUIDADA
          ? data.valor_faturado
          : 0
      : 0;

    const created = await faturamentoRepository.createFatura({
      ...data,
      valor_pago: valorPagoInicial,
      quinzena: data.quinzena ?? (data.numero_periodo || 1),
      criado_por: criadoPor || null,
    });

    if (isLiquidadaOuParcial && valorPagoInicial > 0) {
      await faturamentoRepository.syncValorRecebimentoFatura(created.id, valorPagoInicial);
      const reloaded = await faturamentoRepository.getFaturaById(created.id);
      if (reloaded) return reloaded;
    }

    return created;
  },

  async updateFatura(id: string, data: UpdateFaturaDTO): Promise<FaturaCliente> {
    if (id.startsWith("prev_")) {
      const materializada = await this._materializarPrevisao(id, data as Partial<FaturaCliente>);
      return this.updateFatura(materializada.id, data);
    }
    const exists = await faturamentoRepository.getFaturaById(id);
    if (!exists) throw new AppError("Fatura não encontrada", 404);

    const updatePayload: Record<string, unknown> = { ...data };
    const statusAlvo = data.status ?? exists.status;

    if (
      statusAlvo === STATUS_FATURA.PENDENTE ||
      statusAlvo === STATUS_FATURA.CANCELADA
    ) {
      await faturamentoRepository.deleteRecebimentosPorFatura(id);
      updatePayload.valor_pago = 0;
    } else if (
      statusAlvo === STATUS_FATURA.LIQUIDADA ||
      statusAlvo === STATUS_FATURA.PAGO_PARCIAL
    ) {
      const valorFaturadoRef = Number(
        data.valor_faturado ?? exists.valor_faturado ?? 0
      );
      const valorPagoInput =
        data.valor_pago !== undefined
          ? data.valor_pago
          : Number(exists.valor_pago || 0);
      const novoValorPago =
        valorPagoInput > 0
          ? valorPagoInput
          : statusAlvo === STATUS_FATURA.LIQUIDADA
            ? valorFaturadoRef
            : 0;
      updatePayload.valor_pago = novoValorPago;
      await faturamentoRepository.syncValorRecebimentoFatura(
        id,
        novoValorPago
      );
    }

    return faturamentoRepository.updateFatura(id, updatePayload);
  },

  async deleteFatura(id: string): Promise<void> {
    if (id.startsWith("prev_")) {
      await this._materializarPrevisao(id, { status: STATUS_FATURA.CANCELADA });
      return;
    }
    const exists = await faturamentoRepository.getFaturaById(id);
    if (!exists) throw new AppError("Fatura não encontrada", 404);
    await faturamentoRepository.deleteRecebimentosPorFatura(id);
    await faturamentoRepository.updateFatura(id, {
      status: STATUS_FATURA.CANCELADA,
      valor_pago: 0,
    });
  },

  async cancelarFaturasLote(ids: string[], criadoPor?: string): Promise<{ canceladas: number }> {
    if (!ids || ids.length === 0) {
      return { canceladas: 0 };
    }

    const prevIds = ids.filter((id) => id.startsWith("prev_"));
    const realIds = ids.filter((id) => !id.startsWith("prev_"));
    let canceladas = 0;

    if (realIds.length > 0) {
      await faturamentoRepository.deleteRecebimentosPorFaturasLote(realIds);
      const countReais = await faturamentoRepository.updateFaturasStatusLote(
        realIds,
        STATUS_FATURA.CANCELADA
      );
      canceladas += countReais;
    }

    if (prevIds.length > 0) {
      const uniqueUnidadeIds = [...new Set(prevIds.map((prevId) => Number(prevId.split("_")[1])))];
      const [unidades, empresas] = await Promise.all([
        faturamentoRepository.getUnidadesParaMedicaoLote(uniqueUnidadeIds),
        faturamentoRepository.listEmpresasAtivas(),
      ]);

      const recordsToInsert = montarPayloadsCancelamentoPrevisoes(
        prevIds,
        unidades,
        empresas,
        criadoPor
      );

      if (recordsToInsert.length > 0) {
        const countVirtuais = await faturamentoRepository.createFaturasLote(recordsToInsert);
        canceladas += countVirtuais;
      }
    }

    return { canceladas };
  },

  async liquidarFaturaIndividual(
    faturaId: string,
    payload: LiquidarFaturaIndividualDTO,
    criadoPor?: string
  ): Promise<FaturaCliente> {
    return faturamentoLiquidacaoService.liquidarFaturaIndividual(
      faturaId,
      payload,
      (prevId, overrides, criador) => this._materializarPrevisao(prevId, overrides, criador),
      criadoPor
    );
  },

  async processarLoteRecebimento(payload: LoteRecebimentoDTO, criadoPor?: string): Promise<LoteRecebimento> {
    return faturamentoLiquidacaoService.processarLoteRecebimento(
      payload,
      (prevId, overrides, criador) => this._materializarPrevisao(prevId, overrides, criador),
      criadoPor
    );
  },

  async getAgingRecebiveis(filtros: {
    mes?: number;
    ano?: number;
    empresa_id?: number;
  }): Promise<AgingRecebiveisResultado> {
    const faturas = await faturamentoRepository.listFaturasAging(filtros);
    return calcularAgingRecebiveis(faturas, filtros);
  },

  async desfazerLiquidacaoFatura(faturaId: string): Promise<FaturaCliente> {
    return faturamentoLiquidacaoService.desfazerLiquidacaoFatura(faturaId);
  },
};
