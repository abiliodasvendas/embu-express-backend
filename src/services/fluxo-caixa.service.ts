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
  inicializarMapaDias,
  consolidarCurvaDiaria,
  filtrarMovimentacoesAvulsasFluxo,
  distribuirDespesasEFaturasNoMapa,
} from "../utils/fluxo-caixa-distribuicao.helper.js";
import {
  STATUS_DESPESA,
  STATUS_FATURA,
  STATUS_FATURA_CONVENIO,
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
    dia_convenios?: number;
    dia_vales: number;
  };
}

export const fluxoCaixaService = {
  async getFluxoCaixa(
    mes: number,
    ano: number,
    empresaId?: number
  ): Promise<FluxoCaixaResponse> {
    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

    const fechamentoCaixa = await fluxoCaixaRepository.getFechamentoCaixa(mes, ano);

    const { shareEmpresa } = await calcularShareHolding(empresaId, mes, ano);
    const faturasList = await faturamentoService.listFaturas({ mes, ano });
    const todasFaturasHolding = (faturasList || []).filter(
      (f) => f.status !== STATUS_FATURA.CANCELADA
    );
    const faturas = empresaId
      ? todasFaturasHolding.filter((f) => Number(f.empresa_id) === Number(empresaId))
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
    const ultimoDiaMesAnterior = new Date(
      Date.UTC(anoAnterior, mesAnterior, 0)
    ).getUTCDate();
    const dataInicioMesAntStr = `${anoAnterior}-${String(mesAnterior).padStart(2, "0")}-01`;
    const dataFimMesAntStr = `${anoAnterior}-${String(mesAnterior).padStart(2, "0")}-${String(ultimoDiaMesAnterior).padStart(2, "0")}`;

    const dashboardFolhaAnt = await financeiroService.getDashboardLote(
      mesAnterior,
      anoAnterior
    );
    let desembolsoSalariosProjetado = Number(
      dashboardFolhaAnt.saldoFinalFolha ||
        dashboardFolhaAnt.restaPagar + dashboardFolhaAnt.valorPago ||
        dashboardFolhaAnt.totalFolha ||
        0
    );
    let desembolsoSalariosRealizado = Number(dashboardFolhaAnt.valorPago || 0);
    if (empresaId) {
      desembolsoSalariosProjetado = desembolsoSalariosProjetado * shareEmpresa;
      desembolsoSalariosRealizado = desembolsoSalariosRealizado * shareEmpresa;
    }

    const [conveniosAnt, faturasConveniosAnt] = await Promise.all([
      convenioAuditoriaRepository.listLancamentosGeraisPeriodo(
        dataInicioMesAntStr,
        dataFimMesAntStr
      ),
      convenioAuditoriaRepository.listFaturasPorCompetencia(mesAnterior, anoAnterior),
    ]);

    const faturasAntMap = new Map<
      string,
      { valor_total: number; valor_pago: number | null; status: string }
    >();
    faturasConveniosAnt.forEach((f) => {
      faturasAntMap.set(f.convenio_id, {
        valor_total: Number(f.valor_total_fatura || 0),
        valor_pago: f.valor_pago ? Number(f.valor_pago) : null,
        status: f.status,
      });
    });

    const consumoPorConvenioMap = new Map<string, number>();
    conveniosAnt.forEach((c) => {
      const v = Number(c.valor || 0);
      consumoPorConvenioMap.set(
        c.convenio_id,
        (consumoPorConvenioMap.get(c.convenio_id) || 0) + v
      );
    });

    const allConvenioIds = new Set([
      ...faturasAntMap.keys(),
      ...consumoPorConvenioMap.keys(),
    ]);

    let saldoRetidoConvenios = conveniosAnt
      .filter((c) => !isDavidOuMotoEmbu(c) && c.colaborador_id)
      .reduce((acc, c) => acc + Number(c.valor || 0), 0);

    if (empresaId) {
      saldoRetidoConvenios = saldoRetidoConvenios * shareEmpresa;
    }

    const [
      dashboardFolhaAtual,
      configSalarios,
      configVales,
      conveniosCadastrados,
    ] = await Promise.all([
      financeiroService.getDashboardLote(mes, ano),
      configuracaoService.getConfiguracao("dia_desembolso_salarios"),
      configuracaoService.getConfiguracao("dia_desembolso_vales"),
      convenioAuditoriaRepository.listConveniosParaResumo(),
    ]);

    const diaSalarios = Math.min(
      Math.max(parseInt(configSalarios?.valor || "7", 10) || 7, 1),
      ultimoDiaMes
    );
    const diaVales = Math.min(
      Math.max(parseInt(configVales?.valor || "20", 10) || 20, 1),
      ultimoDiaMes
    );
    const conveniosCadastradosMap = new Map(
      (conveniosCadastrados || []).map((c) => [c.id, c])
    );

    let valesDiaValesProjetado = Number(
      dashboardFolhaAtual.totalAdiantamentoPrevisto || 0
    );
    let valesDiaValesRealizado = Number(
      dashboardFolhaAtual.totalAdiantamentoPago || 0
    );
    if (empresaId) {
      valesDiaValesProjetado = valesDiaValesProjetado * shareEmpresa;
      valesDiaValesRealizado = valesDiaValesRealizado * shareEmpresa;
    }

    const despesasList = await despesaService.list({ mes, ano });
    const despesasValidas = despesasList.filter(
      (d) => d.status !== STATUS_DESPESA.CANCELADO
    );

    const despesas = empresaId
      ? (despesasValidas
          .map((d) => {
            if (d.empresa_id && Number(d.empresa_id) === Number(empresaId))
              return d;
            if (!d.empresa_id) {
              return {
                ...d,
                valor_previsto: Number(d.valor_previsto || 0) * shareEmpresa,
                valor_pago:
                  d.valor_pago !== null && d.valor_pago !== undefined
                    ? Number(d.valor_pago) * shareEmpresa
                    : null,
                descricao: `${d.descricao} (Rateio)`,
              };
            }
            return null;
          })
          .filter(Boolean) as DespesaOperacional[])
      : despesasValidas;

    const todasMovAvulsas =
      await fluxoCaixaRepository.listMovimentacoesAvulsasPeriodo(mes, ano);
    const movAvulsas = filtrarMovimentacoesAvulsasFluxo(
      todasMovAvulsas,
      empresaId
    );

    const transferenciasIntercompany = empresaId
      ? await intercompanyRepository.listTransferencias()
      : [];

    const mapaDias = inicializarMapaDias(ultimoDiaMes);

    const diaSalariosObj = mapaDias.get(diaSalarios);
    if (
      diaSalariosObj &&
      (desembolsoSalariosProjetado > 0 || desembolsoSalariosRealizado > 0)
    ) {
      diaSalariosObj.saidas_proj += desembolsoSalariosProjetado;
      diaSalariosObj.saidas_real += desembolsoSalariosRealizado;
      diaSalariosObj.eventos.push("Pagamento do Salário dos Colaboradores");
    }

    allConvenioIds.forEach((cId) => {
      const conv = conveniosCadastradosMap.get(cId);
      const fatura = faturasAntMap.get(cId);
      const consumo = consumoPorConvenioMap.get(cId) || 0;
      let valorProj = fatura ? fatura.valor_total : consumo;
      let valorReal =
        fatura &&
        (fatura.status === STATUS_FATURA_CONVENIO.PAGA ||
          fatura.status === STATUS_FATURA_CONVENIO.PAGO_PARCIAL)
          ? fatura.valor_pago ?? fatura.valor_total
          : 0;

      if (empresaId) {
        valorProj = valorProj * shareEmpresa;
        valorReal = valorReal * shareEmpresa;
      }

      const diaVencBase = Math.min(
        Math.max(conv?.dia_vencimento_padrao || 15, 1),
        ultimoDiaMes
      );
      const periodicidade = conv?.periodicidade || "MENSAL";
      const nomeConv = conv?.nome || "Convênio";

      if (periodicidade === "QUINZENAL") {
        const dia1 = diaVencBase;
        const dia2 = Math.min(diaVencBase + 15, ultimoDiaMes);
        const vProjPart = parseFloat((valorProj / 2).toFixed(2));
        const vRealPart = parseFloat((valorReal / 2).toFixed(2));

        const objDia1 = mapaDias.get(dia1);
        if (objDia1 && (vProjPart > 0 || vRealPart > 0)) {
          objDia1.saidas_proj += vProjPart;
          objDia1.saidas_real += vRealPart;
          objDia1.eventos.push(`${nomeConv} (1ª Quinzena)`);
        }

        const objDia2 = mapaDias.get(dia2);
        if (objDia2 && (vProjPart > 0 || vRealPart > 0)) {
          objDia2.saidas_proj += vProjPart;
          objDia2.saidas_real += vRealPart;
          objDia2.eventos.push(`${nomeConv} (2ª Quinzena)`);
        }
      } else {
        const objDia = mapaDias.get(diaVencBase);
        if (objDia && (valorProj > 0 || valorReal > 0)) {
          objDia.saidas_proj += valorProj;
          objDia.saidas_real += valorReal;
          objDia.eventos.push(nomeConv);
        }
      }
    });

    const diaValesObj = mapaDias.get(diaVales);
    if (
      diaValesObj &&
      (valesDiaValesProjetado > 0 || valesDiaValesRealizado > 0)
    ) {
      diaValesObj.saidas_proj += valesDiaValesProjetado;
      diaValesObj.saidas_real += valesDiaValesRealizado;
      diaValesObj.eventos.push("Adiantamento Salarial");
    }

    distribuirDespesasEFaturasNoMapa({
      mapaDias,
      despesas,
      faturas,
      movAvulsas,
      transferenciasIntercompany,
      mes,
      ano,
      empresaId,
    });

    const consolidado = consolidarCurvaDiaria(
      mapaDias,
      ultimoDiaMes,
      mes,
      ano,
      saldoInicial
    );

    return {
      periodo: { mes, ano },
      empresa_id: empresaId || null,
      saldo_inicial: parseFloat(saldoInicial.toFixed(2)),
      saldo_retido_convenios: parseFloat(saldoRetidoConvenios.toFixed(2)),
      total_entradas_projetadas: consolidado.totalEntradasProjetadas,
      total_entradas_realizadas: consolidado.totalEntradasRealizadas,
      total_saidas_projetadas: consolidado.totalSaidasProjetadas,
      total_saidas_realizadas: consolidado.totalSaidasRealizadas,
      saldo_final_projetado: consolidado.saldoFinalProjetado,
      saldo_final_realizado: consolidado.saldoFinalRealizado,
      curva_diaria: consolidado.curvaDiaria,
      config_dias: {
        dia_salarios: diaSalarios,
        dia_vales: diaVales,
      },
    };
  },

  async setSaldoInicial(
    mes: number,
    ano: number,
    saldoInicial: number,
    fechadoPor?: string
  ) {
    return fluxoCaixaRepository.upsertFechamentoCaixa({
      mes,
      ano,
      saldo_inicial_consolidado: saldoInicial,
      fechado_por: fechadoPor || null,
    });
  },
};
