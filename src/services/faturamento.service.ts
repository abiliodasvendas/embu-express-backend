import { AppError } from "../errors/AppError.js";
import { FaturaCliente, LoteRecebimento, StatusFatura, AgingRecebiveisResultado } from "../types/database.js";
import { faturamentoRepository, ListFaturasFilters } from "../repositories/faturamento.repository.js";
import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";
import {
  faturaClienteSchema,
  updateFaturaClienteSchema,
  loteRecebimentoSchema,
  liquidarFaturaIndividualSchema,
} from "../schemas/faturamento.schema.js";
import { z } from "zod";
import {
  STATUS_FATURA,
  STATUS_INTERCOMPANY,
  TIPO_PERIODO_FATURA,
} from "../constants/financeiro.enum.js";
import {
  getQuinzenasCompetencia,
  getMensalCompetencia,
  getSemanasCompetencia,
  PeriodoCalculado,
} from "../utils/periodo-faturamento.helper.js";
import {
  gerarProjecoesVirtuais,
  montarPayloadMaterializacao,
} from "../utils/faturamento-projecao.helper.js";
import { calcularAgingRecebiveis } from "../utils/faturamento-aging.helper.js";

type CreateFaturaDTO = z.infer<typeof faturaClienteSchema>;
type UpdateFaturaDTO = z.infer<typeof updateFaturaClienteSchema>;
type LoteRecebimentoDTO = z.infer<typeof loteRecebimentoSchema>;
type LiquidarFaturaIndividualDTO = z.infer<typeof liquidarFaturaIndividualSchema>;

export const faturamentoService = {
  async calcularSugestaoMedicao(
    params: {
      unidadeId?: number;
      clienteId?: number;
      mes: number;
      ano: number;
      tipoPeriodo?: string;
      numeroPeriodo?: number;
      quinzena?: number | null;
    }
  ) {
    const { mes, ano, tipoPeriodo, numeroPeriodo, quinzena } = params;
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

    const tipo = tipoPeriodo || (unidade.periodicidade || TIPO_PERIODO_FATURA.QUINZENAL);
    const num = numeroPeriodo || quinzena || 1;
    const valorBase = Number(unidade.valor_contrato_mensal || 0);

    let periodosCalculados: PeriodoCalculado[] = [];
    let valorSugerido = valorBase;

    if (tipo === TIPO_PERIODO_FATURA.SEMANAL) {
      periodosCalculados = getSemanasCompetencia(mes, ano);
      valorSugerido = valorBase;
    } else if (tipo === TIPO_PERIODO_FATURA.MENSAL) {
      periodosCalculados = getMensalCompetencia(mes, ano, unidade.dia_vencimento_padrao || 10);
      valorSugerido = valorBase;
    } else {
      periodosCalculados = getQuinzenasCompetencia(
        mes,
        ano,
        unidade.dia_vencimento_padrao,
        unidade.dia_vencimento_segunda_quinzena
      );
      valorSugerido = parseFloat((valorBase / 2).toFixed(2));
    }

    const periodoEncontrado =
      periodosCalculados.find((p) => p.numero_periodo === num) ||
      periodosCalculados[0] || {
        numero_periodo: num,
        data_inicio: `${ano}-${String(mes).padStart(2, "0")}-01`,
        data_fim: `${ano}-${String(mes).padStart(2, "0")}-15`,
        data_vencimento: `${ano}-${String(mes).padStart(2, "0")}-16`,
        descricao: "",
      };

    return {
      cliente_id: unidade.cliente_id,
      unidade_id: unidade.id,
      tipo_periodo: tipo,
      numero_periodo: periodoEncontrado.numero_periodo,
      valor_base: valorBase,
      periodo: {
        data_inicio: periodoEncontrado.data_inicio,
        data_fim: periodoEncontrado.data_fim,
        data_vencimento: periodoEncontrado.data_vencimento,
      },
      dias_esperados: 0,
      dias_trabalhados: 0,
      faltas_sem_cobertura: 0,
      valor_sugerido: valorSugerido,
    };
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
    return faturamentoRepository.createFatura({
      ...data,
      quinzena: data.quinzena ?? (data.numero_periodo || 1),
      criado_por: criadoPor || null,
    });
  },

  async updateFatura(id: string, data: UpdateFaturaDTO): Promise<FaturaCliente> {
    if (id.startsWith("prev_")) {
      return this._materializarPrevisao(id, data as Partial<FaturaCliente>);
    }
    const exists = await faturamentoRepository.getFaturaById(id);
    if (!exists) throw new AppError("Fatura não encontrada", 404);
    return faturamentoRepository.updateFatura(id, data as Record<string, unknown>);
  },

  async deleteFatura(id: string): Promise<void> {
    if (id.startsWith("prev_")) {
      await this._materializarPrevisao(id, { status: STATUS_FATURA.CANCELADA });
      return;
    }
    const exists = await faturamentoRepository.getFaturaById(id);
    if (!exists) throw new AppError("Fatura não encontrada", 404);
    await faturamentoRepository.updateFatura(id, { status: STATUS_FATURA.CANCELADA });
  },

  async cancelarFaturasLote(ids: string[], criadoPor?: string): Promise<{ canceladas: number }> {
    if (!ids || ids.length === 0) {
      return { canceladas: 0 };
    }

    const prevIds: string[] = [];
    const realIds: string[] = [];

    for (const id of ids) {
      if (id.startsWith("prev_")) {
        prevIds.push(id);
      } else {
        realIds.push(id);
      }
    }

    let canceladas = 0;

    if (realIds.length > 0) {
      const countReais = await faturamentoRepository.updateFaturasStatusLote(
        realIds,
        STATUS_FATURA.CANCELADA
      );
      canceladas += countReais;
    }

    if (prevIds.length > 0) {
      const parsedPrevs = prevIds.map((prevId) => {
        const parts = prevId.split("_");
        return {
          unidadeId: Number(parts[1]),
          mes: Number(parts[2]),
          ano: Number(parts[3]),
          numPeriodo: Number(parts[4]),
        };
      });

      const uniqueUnidadeIds = [...new Set(parsedPrevs.map((p) => p.unidadeId))];

      const [unidades, empresas] = await Promise.all([
        faturamentoRepository.getUnidadesParaMedicaoLote(uniqueUnidadeIds),
        faturamentoRepository.listEmpresasAtivas(),
      ]);

      const unidadesMap = new Map(unidades.map((u) => [u.id, u]));
      const fallbackEmpresa = empresas[0] || { id: 1 };

      const recordsToInsert: Record<string, unknown>[] = [];

      for (const p of parsedPrevs) {
        const unidade = unidadesMap.get(p.unidadeId);
        if (!unidade) continue;

        const empresaId = unidade.empresa_emissora_padrao_id || fallbackEmpresa.id;
        const record = montarPayloadMaterializacao(
          unidade,
          p.mes,
          p.ano,
          p.numPeriodo,
          empresaId,
          { status: STATUS_FATURA.CANCELADA },
          criadoPor
        );
        recordsToInsert.push(record);
      }

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
    if (faturaId.startsWith("prev_")) {
      const materializada = await this._materializarPrevisao(faturaId, undefined, criadoPor);
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

    const recebimento = await faturamentoRepository.createRecebimento({
      fatura_id: fatura.id,
      conta_bancaria_id,
      data_recebimento: data_pagamento,
      valor_alocado: valor_pago,
      observacao: observacao || null,
      criado_por: criadoPor || null,
    });

    const valorPagoAtual = Number(fatura.valor_pago || 0);
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

  async processarLoteRecebimento(payload: LoteRecebimentoDTO, criadoPor?: string): Promise<LoteRecebimento> {
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
        const materializada = await this._materializarPrevisao(item.fatura_id, undefined, criadoPor);
        item.fatura_id = materializada.id;
      }

      const fatura = await faturamentoRepository.getFaturaById(item.fatura_id);
      if (!fatura) {
        throw new AppError(`Fatura ${item.fatura_id} não encontrada`, 404);
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

      const novoValorPago = parseFloat((Number(fatura.valor_pago || 0) + item.valor_alocado).toFixed(2));
      const valorFaturadoBase = Number(fatura.valor_faturado || 0);
      const valorFaturadoFinal = Math.max(valorFaturadoBase, novoValorPago);
      const novoStatus: StatusFatura = novoValorPago >= valorFaturadoFinal ? STATUS_FATURA.LIQUIDADA : STATUS_FATURA.PAGO_PARCIAL;

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

  async getAgingRecebiveis(filtros: {
    mes?: number;
    ano?: number;
    empresa_id?: number;
  }): Promise<AgingRecebiveisResultado> {
    const faturas = await faturamentoRepository.listFaturasAging(filtros);
    return calcularAgingRecebiveis(faturas, filtros);
  },
};
