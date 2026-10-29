import { fluxoCaixaRepository } from "../repositories/fluxo-caixa.repository.js";
import { convenioAuditoriaRepository } from "../repositories/convenio-auditoria.repository.js";
import { intercompanyRepository } from "../repositories/intercompany.repository.js";
import { financeiroService } from "./financeiro.service.js";
import { despesaService } from "./despesa.service.js";
import { faturamentoService } from "./faturamento.service.js";
import { configuracaoService } from "./configuracao.service.js";
import { calcularShareHolding } from "../utils/rateio-corporativo.helper.js";
import { isDavidOuMotoEmbu } from "./convenio-regras.service.js";
import {
  STATUS_DESPESA,
  STATUS_FATURA,
  STATUS_FATURA_CONVENIO,
  STATUS_INTERCOMPANY,
  TIPO_MOVIMENTACAO_AVULSA,
} from "../constants/financeiro.enum.js";
import { DespesaOperacional } from "../types/database.js";

export interface PontoFluxoDia {
  dia: number;
  data: string;
  entradas_projetadas: number;
  entradas_realizadas: number;
  saidas_projetadas: number;
  saidas_realizadas: number;
  saldo_projetado_acumulado: number;
  saldo_realizado_acumulado: number;
  eventos: string[];
}

export interface FluxoCaixaResponse {
  periodo: { mes: number; ano: number };
  empresa_id?: number | null;
  saldo_inicial: number;
  saldo_retido_convenios: number;
  total_entradas_projetadas: number;
  total_entradas_realizadas: number;
  total_saidas_projetadas: number;
  total_saidas_realizadas: number;
  saldo_final_projetado: number;
  saldo_final_realizado: number;
  curva_diaria: PontoFluxoDia[];
  config_dias?: {
    dia_salarios: number;
    dia_convenios: number;
    dia_vales: number;
  };
}

export const fluxoCaixaService = {
  async getFluxoCaixa(mes: number, ano: number, empresaId?: number): Promise<FluxoCaixaResponse> {
    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFimStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

    const fechamentoCaixa = await fluxoCaixaRepository.getFechamentoCaixa(mes, ano);

    const { shareEmpresa, totalFaturamentoHolding } = await calcularShareHolding(empresaId, mes, ano);
    const faturasList = await faturamentoService.listFaturas({ mes, ano });
    const todasFaturasHolding = (faturasList || []).filter(f => f.status !== STATUS_FATURA.CANCELADA);
    const faturas = empresaId
      ? todasFaturasHolding.filter(f => Number(f.empresa_id) === Number(empresaId))
      : todasFaturasHolding;

    let saldoInicial = Number(fechamentoCaixa?.saldo_inicial_consolidado || 0);
    if (empresaId) {
      saldoInicial = saldoInicial * shareEmpresa;
    }

    let mesAnterior = mes - 1;
    let anoAnterior = ano;
    if (mesAnterior === 0) {
      mesAnterior = 12;
      anoAnterior = ano - 1;
    }
    const ultimoDiaMesAnterior = new Date(Date.UTC(anoAnterior, mesAnterior, 0)).getUTCDate();
    const dataInicioMesAntStr = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`;
    const dataFimMesAntStr = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(ultimoDiaMesAnterior).padStart(2, '0')}`;

    const dashboardFolhaAnt = await financeiroService.getDashboardLote(mesAnterior, anoAnterior);
    let desembolsoSalariosProjetado = Number(dashboardFolhaAnt.saldoFinalFolha || (dashboardFolhaAnt.restaPagar + dashboardFolhaAnt.valorPago) || dashboardFolhaAnt.totalFolha || 0);
    let desembolsoSalariosRealizado = Number(dashboardFolhaAnt.valorPago || 0);
    if (empresaId) {
      desembolsoSalariosProjetado = desembolsoSalariosProjetado * shareEmpresa;
      desembolsoSalariosRealizado = desembolsoSalariosRealizado * shareEmpresa;
    }

    const [conveniosAnt, faturasConveniosAnt] = await Promise.all([
      convenioAuditoriaRepository.listLancamentosGeraisPeriodo(dataInicioMesAntStr, dataFimMesAntStr),
      convenioAuditoriaRepository.listFaturasPorCompetencia(mesAnterior, anoAnterior),
    ]);

    const faturasAntMap = new Map<string, { valor_total: number; valor_pago: number | null; status: string }>();
    faturasConveniosAnt.forEach(f => {
      faturasAntMap.set(f.convenio_id, {
        valor_total: Number(f.valor_total_fatura || 0),
        valor_pago: f.valor_pago ? Number(f.valor_pago) : null,
        status: f.status,
      });
    });

    const consumoPorConvenioMap = new Map<string, number>();
    conveniosAnt.forEach(c => {
      const v = Number(c.valor || 0);
      consumoPorConvenioMap.set(c.convenio_id, (consumoPorConvenioMap.get(c.convenio_id) || 0) + v);
    });

    const allConvenioIds = new Set([...faturasAntMap.keys(), ...consumoPorConvenioMap.keys()]);
    let totalConveniosDesembolsoProjetado = 0;
    let totalConveniosDesembolsoRealizado = 0;

    allConvenioIds.forEach(cId => {
      const fatura = faturasAntMap.get(cId);
      const consumo = consumoPorConvenioMap.get(cId) || 0;
      const valorProj = fatura ? fatura.valor_total : consumo;
      totalConveniosDesembolsoProjetado += valorProj;

      if (fatura && (fatura.status === STATUS_FATURA_CONVENIO.PAGA || fatura.status === STATUS_FATURA_CONVENIO.PAGO_PARCIAL)) {
        totalConveniosDesembolsoRealizado += (fatura.valor_pago ?? fatura.valor_total);
      }
    });

    let saldoRetidoConvenios = conveniosAnt.filter(c => !isDavidOuMotoEmbu(c) && c.colaborador_id).reduce((acc, c) => acc + Number(c.valor || 0), 0);

    if (empresaId) {
      totalConveniosDesembolsoProjetado = totalConveniosDesembolsoProjetado * shareEmpresa;
      totalConveniosDesembolsoRealizado = totalConveniosDesembolsoRealizado * shareEmpresa;
      saldoRetidoConvenios = saldoRetidoConvenios * shareEmpresa;
    }

    const [confirmacoesAtual, linksAtivos, configSalarios, configConvenios, configVales] = await Promise.all([
      fluxoCaixaRepository.listConfirmacoesAdiantamento(mes, ano),
      fluxoCaixaRepository.listColaboradorClientesAtivos(),
      configuracaoService.getConfiguracao("dia_desembolso_salarios"),
      configuracaoService.getConfiguracao("dia_desembolso_convenios"),
      configuracaoService.getConfiguracao("dia_desembolso_vales"),
    ]);

    const diaSalarios = Math.min(Math.max(parseInt(configSalarios?.valor || "7", 10) || 7, 1), ultimoDiaMes);
    const diaConvenios = Math.min(Math.max(parseInt(configConvenios?.valor || "15", 10) || 15, 1), ultimoDiaMes);
    const diaVales = Math.min(Math.max(parseInt(configVales?.valor || "20", 10) || 20, 1), ultimoDiaMes);

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const diaAtual = hoje.getDate();

    const isMesPassado = anoAtual > ano || (anoAtual === ano && mesAtual > mes);
    const isMesAtual = anoAtual === ano && mesAtual === mes;
    const isPosDiaVales = isMesPassado || (isMesAtual && diaAtual > diaVales);
    const isDiaValesOuApos = isPosDiaVales || (isMesAtual && diaAtual === diaVales);

    const confirmacoesMap = new Map<string, number>();
    confirmacoesAtual.forEach(c => {
      confirmacoesMap.set(c.colaborador_id, c.valor !== null && c.valor !== undefined ? Number(c.valor) : -1);
    });

    const valesConfiguradosMap = new Map<string, number>();
    linksAtivos.forEach(l => {
      const atual = valesConfiguradosMap.get(l.colaborador_id) || 0;
      valesConfiguradosMap.set(l.colaborador_id, atual + Number(l.valor_adiantamento || 0));
    });

    let totalValesConfirmados = 0;
    confirmacoesMap.forEach((valor, colabId) => {
      if (valor >= 0) {
        totalValesConfirmados += valor;
      } else {
        totalValesConfirmados += valesConfiguradosMap.get(colabId) || 0;
      }
    });

    let totalValesPendentesTeoricos = 0;
    valesConfiguradosMap.forEach((valorConfig, colabId) => {
      if (!confirmacoesMap.has(colabId)) {
        totalValesPendentesTeoricos += valorConfig;
      }
    });

    let valesDiaValesProjetado = isPosDiaVales
      ? totalValesConfirmados
      : totalValesConfirmados + totalValesPendentesTeoricos;

    let valesDiaValesRealizado = totalValesConfirmados;

    if (empresaId) {
      valesDiaValesProjetado = valesDiaValesProjetado * shareEmpresa;
      valesDiaValesRealizado = valesDiaValesRealizado * shareEmpresa;
    }

    const despesasList = await despesaService.list({ mes, ano });
    const despesasValidas = despesasList.filter(d => d.status !== STATUS_DESPESA.CANCELADO);

    const despesas = empresaId
      ? (despesasValidas.map(d => {
          if (d.empresa_id && Number(d.empresa_id) === Number(empresaId)) return d;
          if (!d.empresa_id) {
            return {
              ...d,
              valor_previsto: Number(d.valor_previsto || 0) * shareEmpresa,
              valor_pago: d.valor_pago !== null && d.valor_pago !== undefined ? Number(d.valor_pago) * shareEmpresa : null,
              descricao: `${d.descricao} (Rateio)`,
            };
          }
          return null;
        }).filter(Boolean) as DespesaOperacional[])
      : despesasValidas;

    const todasMovAvulsas = await fluxoCaixaRepository.listMovimentacoesAvulsasPeriodo(mes, ano);
    const movAvulsas = empresaId
      ? todasMovAvulsas.filter(m => Number(m.empresa_id) === Number(empresaId))
      : todasMovAvulsas;

    const transferenciasIntercompany = empresaId
      ? await intercompanyRepository.listTransferencias()
      : [];

    const mapaDias = new Map<number, {
      entradas_proj: number;
      entradas_real: number;
      saidas_proj: number;
      saidas_real: number;
      eventos: string[];
    }>();

    for (let d = 1; d <= ultimoDiaMes; d++) {
      mapaDias.set(d, {
        entradas_proj: 0,
        entradas_real: 0,
        saidas_proj: 0,
        saidas_real: 0,
        eventos: [],
      });
    }

    const diaSalariosObj = mapaDias.get(diaSalarios);
    if (diaSalariosObj && (desembolsoSalariosProjetado > 0 || desembolsoSalariosRealizado > 0)) {
      diaSalariosObj.saidas_proj += desembolsoSalariosProjetado;
      diaSalariosObj.saidas_real += desembolsoSalariosRealizado;
      diaSalariosObj.eventos.push("Pagamento do Salário dos Colaboradores");
    }

    const diaConveniosObj = mapaDias.get(diaConvenios);
    if (diaConveniosObj && (totalConveniosDesembolsoProjetado > 0 || totalConveniosDesembolsoRealizado > 0)) {
      diaConveniosObj.saidas_proj += totalConveniosDesembolsoProjetado;
      diaConveniosObj.saidas_real += totalConveniosDesembolsoRealizado;
      diaConveniosObj.eventos.push("Pagamento dos Postos e Oficinas (Convênios)");
    }

    const diaValesObj = mapaDias.get(diaVales);
    if (diaValesObj && (valesDiaValesProjetado > 0 || valesDiaValesRealizado > 0)) {
      diaValesObj.saidas_proj += valesDiaValesProjetado;
      diaValesObj.saidas_real += valesDiaValesRealizado;
      diaValesObj.eventos.push("Adiantamento Salarial");
    }

    (despesas || []).forEach(desp => {
      const diaVenc = parseInt(desp.data_vencimento.split("-")[2], 10);
      const diaObj = mapaDias.get(diaVenc);
      if (diaObj) {
        const valor = Number(desp.valor_previsto || 0);
        if (desp.status !== STATUS_DESPESA.ADIADA) {
          diaObj.saidas_proj += valor;
          diaObj.eventos.push(`${desp.descricao} (R$ ${valor.toFixed(2)})`);
        } else {
          diaObj.eventos.push(`[ADIADA] ${desp.descricao}`);
        }
      }

      const valorPago = Number(desp.valor_pago || (desp.status === STATUS_DESPESA.PAGO ? desp.valor_previsto : 0) || 0);
      if (valorPago > 0) {
        let diaPagto = diaVenc;
        if (desp.data_pagamento) {
          const [pagAno, pagMes, pagDia] = desp.data_pagamento.split("-").map(Number);
          if (pagAno === ano && pagMes === mes) {
            diaPagto = pagDia;
          }
        }
        const diaPagtoObj = mapaDias.get(diaPagto);
        if (diaPagtoObj) {
          diaPagtoObj.saidas_real += valorPago;
        }
      }
    });

    (faturas || []).forEach(fat => {
      const diaVenc = parseInt(fat.data_vencimento.split("-")[2], 10);
      const diaObj = mapaDias.get(diaVenc);
      if (diaObj) {
        diaObj.entradas_proj += Number(fat.valor_faturado || 0);
      }

      (fat.recebimentos || []).forEach((rec: { data_recebimento: string; valor_alocado: number }) => {
        const diaRec = parseInt(rec.data_recebimento.split("-")[2], 10);
        const diaRecObj = mapaDias.get(diaRec);
        if (diaRecObj) {
          diaRecObj.entradas_real += Number(rec.valor_alocado || 0);
        }
      });
    });

    (movAvulsas || []).forEach(mov => {
      const diaMov = parseInt(mov.data_movimentacao.split("-")[2], 10);
      const diaObj = mapaDias.get(diaMov);
      if (diaObj) {
        const valor = Number(mov.valor || 0);
        if (mov.tipo_movimentacao === TIPO_MOVIMENTACAO_AVULSA.ENTRADA) {
          diaObj.entradas_proj += valor;
          diaObj.entradas_real += valor;
          diaObj.eventos.push(`[ENTRADA AVULSA] ${mov.descricao} (R$ ${valor.toFixed(2)})`);
        } else {
          diaObj.saidas_proj += valor;
          diaObj.saidas_real += valor;
          diaObj.eventos.push(`[SAÍDA AVULSA] ${mov.descricao} (R$ ${valor.toFixed(2)})`);
        }
      }
    });

    if (empresaId) {
      transferenciasIntercompany.forEach(t => {
        const dataRef = t.data_acerto || t.data_fato_gerador;
        if (!dataRef) return;
        const [tAno, tMes, tDia] = dataRef.split("-").map(Number);
        if (tAno === ano && tMes === mes) {
          const diaObj = mapaDias.get(tDia);
          if (diaObj) {
            const valor = Number(t.valor || 0);
            if (Number(t.empresa_credora_id) === Number(empresaId)) {
              diaObj.entradas_proj += valor;
              if (t.status === STATUS_INTERCOMPANY.COMPENSADO) {
                diaObj.entradas_real += valor;
              }
              const nomeDevedora = t.empresa_devedora?.nome_fantasia || "Empresa do Grupo";
              diaObj.eventos.push(`[ACERTO INTERCOMPANY] Entrada de ${nomeDevedora} (R$ ${valor.toFixed(2)})`);
            } else if (Number(t.empresa_devedora_id) === Number(empresaId)) {
              diaObj.saidas_proj += valor;
              if (t.status === STATUS_INTERCOMPANY.COMPENSADO) {
                diaObj.saidas_real += valor;
              }
              const nomeCredora = t.empresa_credora?.nome_fantasia || "Empresa do Grupo";
              diaObj.eventos.push(`[ACERTO INTERCOMPANY] Saída para ${nomeCredora} (R$ ${valor.toFixed(2)})`);
            }
          }
        }
      });
    }

    let saldoProjetadoAcum = saldoInicial;
    let saldoRealizadoAcum = saldoInicial;

    let totalEntradasProjetadas = 0;
    let totalEntradasRealizadas = 0;
    let totalSaidasProjetadas = 0;
    let totalSaidasRealizadas = 0;

    const curvaDiaria: PontoFluxoDia[] = [];

    for (let d = 1; d <= ultimoDiaMes; d++) {
      const diaData = mapaDias.get(d)!;
      saldoProjetadoAcum += (diaData.entradas_proj - diaData.saidas_proj);
      saldoRealizadoAcum += (diaData.entradas_real - diaData.saidas_real);

      totalEntradasProjetadas += diaData.entradas_proj;
      totalEntradasRealizadas += diaData.entradas_real;
      totalSaidasProjetadas += diaData.saidas_proj;
      totalSaidasRealizadas += diaData.saidas_real;

      const dataDiaStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      curvaDiaria.push({
        dia: d,
        data: dataDiaStr,
        entradas_projetadas: parseFloat(diaData.entradas_proj.toFixed(2)),
        entradas_realizadas: parseFloat(diaData.entradas_real.toFixed(2)),
        saidas_projetadas: parseFloat(diaData.saidas_proj.toFixed(2)),
        saidas_realizadas: parseFloat(diaData.saidas_real.toFixed(2)),
        saldo_projetado_acumulado: parseFloat(saldoProjetadoAcum.toFixed(2)),
        saldo_realizado_acumulado: parseFloat(saldoRealizadoAcum.toFixed(2)),
        eventos: diaData.eventos,
      });
    }

    return {
      periodo: { mes, ano },
      empresa_id: empresaId || null,
      saldo_inicial: parseFloat(saldoInicial.toFixed(2)),
      saldo_retido_convenios: parseFloat(saldoRetidoConvenios.toFixed(2)),
      total_entradas_projetadas: parseFloat(totalEntradasProjetadas.toFixed(2)),
      total_entradas_realizadas: parseFloat(totalEntradasRealizadas.toFixed(2)),
      total_saidas_projetadas: parseFloat(totalSaidasProjetadas.toFixed(2)),
      total_saidas_realizadas: parseFloat(totalSaidasRealizadas.toFixed(2)),
      saldo_final_projetado: parseFloat(saldoProjetadoAcum.toFixed(2)),
      saldo_final_realizado: parseFloat(saldoRealizadoAcum.toFixed(2)),
      curva_diaria: curvaDiaria,
      config_dias: {
        dia_salarios: diaSalarios,
        dia_convenios: diaConvenios,
        dia_vales: diaVales,
      },
    };
  },

  async setSaldoInicial(mes: number, ano: number, saldoInicial: number, fechadoPor?: string) {
    return fluxoCaixaRepository.upsertFechamentoCaixa({
      mes,
      ano,
      saldo_inicial_consolidado: saldoInicial,
      fechado_por: fechadoPor || null,
    });
  },
};
