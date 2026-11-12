import { FINANCEIRO_STATUS } from "../constants/financeiro.enum.js";
import { getNowBR, toBRTime, toLocalDateString } from "../utils/utils.js";
import { ocorrenciaService } from "./ocorrencia.service.js";
import {
  formatFechamento,
  obterColaboradoresElegiveisMes,
  extrairComponentesFolha,
  montarStatusGeralColaboradores,
  montarDashboardLoteVazio,
  formatarResultadoDashboardLote,
} from "../utils/financeiro-fechamento.helper.js";
import { calcularMatematicaExtrato } from "../utils/financeiro-extrato-calc.helper.js";
import { financeiroRepository } from "../repositories/financeiro.repository.js";
import {
  ExtratoMensal,
  FechamentoPayload,
  ConfirmacaoAdiantamentoPayload,
  StatusGeralFechamento,
  DashboardLoteResultado,
} from "../types/financeiro.type.js";

interface DashboardLoteCacheItem {
  timestamp: number;
  data: DashboardLoteResultado;
}

const dashboardLoteCache = new Map<string, DashboardLoteCacheItem>();
const DASHBOARD_CACHE_TTL_MS = 60 * 1000;

export function invalidateDashboardLoteCache(mes?: number, ano?: number) {
  if (mes && ano) {
    dashboardLoteCache.delete(`${mes}-${ano}`);
  } else {
    dashboardLoteCache.clear();
  }
}

export const financeiroService = {
  _calcularMatematicaExtrato: calcularMatematicaExtrato,

  async getExtratoMensal(usuarioId: string, mes: number, ano: number): Promise<ExtratoMensal> {
    const fechamentoExistente = await financeiroRepository.getFechamentoPorCompetencia(
      usuarioId,
      mes,
      ano
    );

    if (fechamentoExistente) {
      return {
        ...(fechamentoExistente.resumo_json as ExtratoMensal),
        status: FINANCEIRO_STATUS.PAGO,
        id_fechamento: fechamentoExistente.id,
        data_pagamento: toBRTime(fechamentoExistente.data_pagamento),
        conta_bancaria_id: fechamentoExistente.conta_bancaria_id || null,
      };
    }

    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    let mesAnterior = mes - 1;
    let anoAnterior = ano;
    if (mesAnterior === 0) {
      mesAnterior = 12;
      anoAnterior = ano - 1;
    }

    const [ocorrencias, dadosExtrato] = await Promise.all([
      ocorrenciaService.listOcorrencias({
        usuario_id: usuarioId,
        data_inicio: dataInicioMesStr,
        data_fim: dataFimMesStr,
      }),
      financeiroRepository.carregarDadosExtratoIndividual({
        usuarioId,
        mes,
        ano,
        mesAnterior,
        anoAnterior,
        dataInicioMesStr,
        dataFimMesStr,
      }),
    ]);

    return this._calcularMatematicaExtrato({
      usuarioId,
      mes,
      ano,
      usuario: dadosExtrato.usuario,
      links: dadosExtrato.links,
      ocorrencias: ocorrencias || [],
      fechamentoAnterior: dadosExtrato.fechamentoAnterior,
      pontos: dadosExtrato.pontos,
      feriadosMes: dadosExtrato.feriadosMes,
      confirmacaoAdiantamento: dadosExtrato.confirmacaoAdiantamento,
      lancamentosConvenios: dadosExtrato.lancamentosConvenios,
    });
  },

  async getDashboardLote(mes: number, ano: number): Promise<DashboardLoteResultado> {
    const cacheKey = `${mes}-${ano}`;
    const cached = dashboardLoteCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < DASHBOARD_CACHE_TTL_MS) {
      return cached.data;
    }

    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    const colaboradoresElegiveis = await obterColaboradoresElegiveisMes({
      mes,
      ano,
      dataInicioMesStr,
      dataFimMesStr,
    });

    if (!colaboradoresElegiveis || colaboradoresElegiveis.length === 0) {
      const emptyResult = montarDashboardLoteVazio();
      dashboardLoteCache.set(cacheKey, { timestamp: Date.now(), data: emptyResult });
      return emptyResult;
    }

    const { fechamentos, todosTurnos, todasConfirmacoes } =
      await financeiroRepository.carregarResumoPagoDashboardLote(mes, ano, dataInicioMesStr);

    const elegiveisIdsSet = new Set(colaboradoresElegiveis.map((c) => c.id));
    const confirmacoesElegiveisIds = new Set(
      todasConfirmacoes.map((c) => c.colaborador_id)
    );

    const turnosFiltrados = todosTurnos.filter(
      (t) =>
        elegiveisIdsSet.has(t.colaborador_id) &&
        (!t.data_inicio || t.data_inicio <= dataFimMesStr)
    );

    const adiantamentoPendenteConfigurado = turnosFiltrados
      .filter((t) => !confirmacoesElegiveisIds.has(t.colaborador_id))
      .reduce((acc, t) => acc + Number(t.valor_adiantamento || 0), 0);

    const colaboradoresAdiantamentoCount = todasConfirmacoes.length;

    const fechamentosMap = new Map<string, { colaborador_id: string; saldo_final: number }>();
    let valorPago = 0;
    let totalFolhaBruta = 0;
    let totalDescontoFaltas = 0;
    let totalDescontoConvenios = 0;
    let totalAdiantamentoPago = 0;

    fechamentos.forEach((f) => {
      fechamentosMap.set(f.colaborador_id, f);
      const saldoPago = Number(f.saldo_final || 0);
      if (saldoPago > 0) {
        valorPago += saldoPago;
      }

      const r = f.resumo_json as Partial<ExtratoMensal> | null;
      if (r) {
        const comp = extrairComponentesFolha(r);
        totalFolhaBruta += comp.bruto;
        totalDescontoFaltas += comp.faltas;
        totalDescontoConvenios += comp.convenios;
        totalAdiantamentoPago += comp.adiantamentoPago;
      }
    });

    const pendentes = colaboradoresElegiveis.filter((c) => !fechamentosMap.has(c.id));

    if (pendentes.length === 0) {
      const allPaidResult = formatarResultadoDashboardLote({
        valorPago,
        restaPagar: 0,
        pendentesCount: 0,
        pagosCount: fechamentos.length,
        totalFolhaBruta,
        totalDescontoFaltas,
        totalDescontoConvenios,
        totalAdiantamentoPago,
        adiantamentoPendenteConfigurado,
        colaboradoresAdiantamentoCount,
      });
      dashboardLoteCache.set(cacheKey, { timestamp: Date.now(), data: allPaidResult });
      return allPaidResult;
    }

    const pendentesIds = pendentes.map((p) => p.id);

    let mesAnterior = mes - 1;
    let anoAnterior = ano;
    if (mesAnterior === 0) {
      mesAnterior = 12;
      anoAnterior = ano - 1;
    }

    const {
      feriadosMes,
      linksPorUsuario,
      ocorrenciasPorUsuario,
      fechamentosAnterioresMap,
      pontosPorUsuario,
      confirmacoesMap,
      conveniosPorUsuario,
    } = await financeiroRepository.carregarDadosPendentesDashboardLote({
      pendentesIds,
      mes,
      ano,
      mesAnterior,
      anoAnterior,
      dataInicioMesStr,
      dataFimMesStr,
    });

    let restaPagar = 0;

    pendentes.forEach((usuario) => {
      const extrato = this._calcularMatematicaExtrato({
        usuarioId: usuario.id,
        mes,
        ano,
        usuario,
        links: linksPorUsuario.get(usuario.id) || [],
        ocorrencias: ocorrenciasPorUsuario.get(usuario.id) || [],
        fechamentoAnterior: fechamentosAnterioresMap.get(usuario.id) || null,
        pontos: pontosPorUsuario.get(usuario.id) || [],
        feriadosMes,
        confirmacaoAdiantamento: confirmacoesMap.get(usuario.id) || null,
        lancamentosConvenios: conveniosPorUsuario.get(usuario.id) || [],
      });

      const saldo = Number(extrato.totais.saldo_final || 0);
      if (saldo > 0) {
        restaPagar += saldo;
      }

      const comp = extrairComponentesFolha(extrato);
      totalFolhaBruta += comp.bruto;
      totalDescontoFaltas += comp.faltas;
      totalDescontoConvenios += comp.convenios;
      totalAdiantamentoPago += comp.adiantamentoPago;
    });

    const resultadoFinal = formatarResultadoDashboardLote({
      valorPago,
      restaPagar,
      pendentesCount: pendentes.length,
      pagosCount: fechamentos.length,
      totalFolhaBruta,
      totalDescontoFaltas,
      totalDescontoConvenios,
      totalAdiantamentoPago,
      adiantamentoPendenteConfigurado,
      colaboradoresAdiantamentoCount,
    });

    dashboardLoteCache.set(cacheKey, { timestamp: Date.now(), data: resultadoFinal });
    return resultadoFinal;
  },

  async processarPagamento(
    usuarioId: string,
    mes: number,
    ano: number,
    pagoPor: string,
    contaBancariaId?: string | null,
    dataPagamento?: string | null,
    lotePagamentoId?: string | null
  ): Promise<ExtratoMensal> {
    const fechamentoExistente = await financeiroRepository.getFechamentoPorCompetencia(
      usuarioId,
      mes,
      ano
    );

    if (fechamentoExistente) {
      const payloadAtualizado: FechamentoPayload = {
        id: fechamentoExistente.id,
        colaborador_id: usuarioId,
        mes,
        ano,
        resumo_json: fechamentoExistente.resumo_json as ExtratoMensal,
        saldo_final: Number(fechamentoExistente.saldo_final || 0),
        fechado_por: fechamentoExistente.fechado_por || pagoPor,
        data_fechamento: fechamentoExistente.data_fechamento || getNowBR(),
        pago: true,
        data_pagamento: dataPagamento || fechamentoExistente.data_pagamento || getNowBR(),
        conta_bancaria_id:
          contaBancariaId !== undefined
            ? contaBancariaId
            : (fechamentoExistente.conta_bancaria_id ?? null),
        lote_pagamento_id:
          lotePagamentoId !== undefined
            ? lotePagamentoId
            : (fechamentoExistente.lote_pagamento_id ?? null),
      };

      const data = await financeiroRepository.upsertFechamento(
        usuarioId,
        mes,
        ano,
        payloadAtualizado
      );
      invalidateDashboardLoteCache(mes, ano);
      return formatFechamento(
        data as unknown as ExtratoMensal & {
          data_fechamento?: string;
          data_pagamento?: string;
          created_at?: string;
        }
      );
    }

    const extrato = await this.getExtratoMensal(usuarioId, mes, ano);
    const dataPagEfetiva = dataPagamento || getNowBR();

    const payload: FechamentoPayload = {
      colaborador_id: usuarioId,
      mes,
      ano,
      resumo_json: extrato,
      saldo_final: extrato.totais.saldo_final,
      fechado_por: pagoPor,
      data_fechamento: getNowBR(),
      pago: true,
      data_pagamento: dataPagEfetiva,
      conta_bancaria_id: contaBancariaId ?? null,
      lote_pagamento_id: lotePagamentoId ?? null,
    };

    const data = await financeiroRepository.upsertFechamento(usuarioId, mes, ano, payload);
    invalidateDashboardLoteCache(mes, ano);
    return formatFechamento(data as unknown as ExtratoMensal & { data_fechamento?: string; data_pagamento?: string; created_at?: string });
  },

  async confirmarAdiantamento(
    usuarioId: string,
    mes: number,
    ano: number,
    confirmadoPor: string,
    valor?: number | null,
    contaBancariaId?: string | null,
    dataPagamento?: string | null,
    lotePagamentoId?: string | null
  ): Promise<boolean> {
    const payload: ConfirmacaoAdiantamentoPayload = {
      colaborador_id: usuarioId,
      mes,
      ano,
      valor: valor !== undefined ? valor : null,
      confirmado_por: confirmadoPor,
      data_confirmacao: getNowBR(),
      conta_bancaria_id: contaBancariaId ?? null,
      data_pagamento: dataPagamento || toLocalDateString(),
      lote_pagamento_id: lotePagamentoId ?? null,
    };

    await financeiroRepository.upsertConfirmacaoAdiantamento(usuarioId, mes, ano, payload);
    invalidateDashboardLoteCache(mes, ano);
    return true;
  },

  async desconfirmarAdiantamento(usuarioId: string, mes: number, ano: number): Promise<void> {
    await financeiroRepository.deleteConfirmacaoAdiantamento(usuarioId, mes, ano);
    invalidateDashboardLoteCache(mes, ano);
  },

  async desfazerPagamento(usuarioId: string, mes: number, ano: number): Promise<void> {
    await financeiroRepository.deleteFechamentoFinanceiro(usuarioId, mes, ano);
    invalidateDashboardLoteCache(mes, ano);
  },

  async getStatusGeral(mes: number, ano: number): Promise<StatusGeralFechamento[]> {
    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    const [colaboradores, { confirmacoes, fechamentos, turnos }] = await Promise.all([
      obterColaboradoresElegiveisMes({
        mes,
        ano,
        dataInicioMesStr,
        dataFimMesStr,
      }),
      financeiroRepository.carregarDadosStatusGeral(mes, ano, dataInicioMesStr),
    ]);

    return montarStatusGeralColaboradores({
      colaboradores,
      confirmacoes,
      fechamentos,
      turnos,
      dataFimMesStr,
    });
  },
};
