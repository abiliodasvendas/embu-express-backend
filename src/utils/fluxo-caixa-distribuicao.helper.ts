import { PontoFluxoDia } from "../services/fluxo-caixa.service.js";
import {
  CATEGORIA_MOVIMENTACAO_AVULSA,
  STATUS_DESPESA,
  STATUS_INTERCOMPANY,
  TIPO_MOVIMENTACAO_AVULSA,
} from "../constants/financeiro.enum.js";
import {
  DespesaOperacional,
  FaturaCliente,
  MovimentacaoAvulsa,
  TransferenciaIntercompany,
} from "../types/database.js";

export interface DiaFluxoAcumulador {
  entradas_proj: number;
  entradas_real: number;
  saidas_proj: number;
  saidas_real: number;
  eventos: string[];
}

export function inicializarMapaDias(ultimoDiaMes: number): Map<number, DiaFluxoAcumulador> {
  const mapa = new Map<number, DiaFluxoAcumulador>();
  for (let d = 1; d <= ultimoDiaMes; d++) {
    mapa.set(d, {
      entradas_proj: 0,
      entradas_real: 0,
      saidas_proj: 0,
      saidas_real: 0,
      eventos: [],
    });
  }
  return mapa;
}

export function filtrarMovimentacoesAvulsasFluxo(
  todasMovAvulsas: MovimentacaoAvulsa[],
  empresaId?: number
): MovimentacaoAvulsa[] {
  const movPorId = new Map(todasMovAvulsas.map((m) => [m.id, m]));
  return todasMovAvulsas.filter((m) => {
    const isTransferencia =
      m.categoria === CATEGORIA_MOVIMENTACAO_AVULSA.TRANSFERENCIA_ENTRE_CONTAS ||
      Boolean(m.transferencia_par_id);
    if (!empresaId) {
      return !isTransferencia;
    }
    if (Number(m.empresa_id) !== Number(empresaId)) {
      return false;
    }
    if (isTransferencia && m.transferencia_par_id) {
      const par = movPorId.get(m.transferencia_par_id);
      if (par && Number(par.empresa_id) === Number(empresaId)) {
        return false;
      }
    }
    return true;
  });
}

export function distribuirDespesasEFaturasNoMapa(params: {
  mapaDias: Map<number, DiaFluxoAcumulador>;
  despesas: DespesaOperacional[];
  faturas: FaturaCliente[];
  movAvulsas: MovimentacaoAvulsa[];
  transferenciasIntercompany: TransferenciaIntercompany[];
  mes: number;
  ano: number;
  empresaId?: number;
}) {
  const {
    mapaDias,
    despesas,
    faturas,
    movAvulsas,
    transferenciasIntercompany,
    mes,
    ano,
    empresaId,
  } = params;

  (despesas || []).forEach((desp) => {
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

    const valorPago = Number(
      desp.valor_pago ||
        (desp.status === STATUS_DESPESA.PAGO ? desp.valor_previsto : 0) ||
        0
    );
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

  (faturas || []).forEach((fat) => {
    const diaVenc = parseInt(fat.data_vencimento.split("-")[2], 10);
    const diaObj = mapaDias.get(diaVenc);
    if (diaObj) {
      diaObj.entradas_proj += Number(fat.valor_faturado || 0);
    }

    (fat.recebimentos || []).forEach(
      (rec: { data_recebimento: string; valor_alocado: number }) => {
        const diaRec = parseInt(rec.data_recebimento.split("-")[2], 10);
        const diaRecObj = mapaDias.get(diaRec);
        if (diaRecObj) {
          diaRecObj.entradas_real += Number(rec.valor_alocado || 0);
        }
      }
    );
  });

  (movAvulsas || []).forEach((mov) => {
    const diaMov = parseInt(mov.data_movimentacao.split("-")[2], 10);
    const diaObj = mapaDias.get(diaMov);
    if (diaObj) {
      const valor = Number(mov.valor || 0);
      if (mov.tipo_movimentacao === TIPO_MOVIMENTACAO_AVULSA.ENTRADA) {
        diaObj.entradas_proj += valor;
        diaObj.entradas_real += valor;
        diaObj.eventos.push(
          `[ENTRADA AVULSA] ${mov.descricao} (R$ ${valor.toFixed(2)})`
        );
      } else {
        diaObj.saidas_proj += valor;
        diaObj.saidas_real += valor;
        diaObj.eventos.push(
          `[SAÍDA AVULSA] ${mov.descricao} (R$ ${valor.toFixed(2)})`
        );
      }
    }
  });

  if (empresaId) {
    transferenciasIntercompany.forEach((t) => {
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
            const nomeDevedora =
              t.empresa_devedora?.nome_fantasia || "Empresa do Grupo";
            diaObj.eventos.push(
              `[ACERTO INTERCOMPANY] Entrada de ${nomeDevedora} (R$ ${valor.toFixed(2)})`
            );
          } else if (Number(t.empresa_devedora_id) === Number(empresaId)) {
            diaObj.saidas_proj += valor;
            if (t.status === STATUS_INTERCOMPANY.COMPENSADO) {
              diaObj.saidas_real += valor;
            }
            const nomeCredora =
              t.empresa_credora?.nome_fantasia || "Empresa do Grupo";
            diaObj.eventos.push(
              `[ACERTO INTERCOMPANY] Saída para ${nomeCredora} (R$ ${valor.toFixed(2)})`
            );
          }
        }
      }
    });
  }
}

export function consolidarCurvaDiaria(
  mapaDias: Map<number, DiaFluxoAcumulador>,
  ultimoDiaMes: number,
  mes: number,
  ano: number,
  saldoInicial: number
) {
  let saldoProjetadoAcum = saldoInicial;
  let saldoRealizadoAcum = saldoInicial;

  let totalEntradasProjetadas = 0;
  let totalEntradasRealizadas = 0;
  let totalSaidasProjetadas = 0;
  let totalSaidasRealizadas = 0;

  const curvaDiaria: PontoFluxoDia[] = [];

  for (let d = 1; d <= ultimoDiaMes; d++) {
    const diaData = mapaDias.get(d)!;
    saldoProjetadoAcum += diaData.entradas_proj - diaData.saidas_proj;
    saldoRealizadoAcum += diaData.entradas_real - diaData.saidas_real;

    totalEntradasProjetadas += diaData.entradas_proj;
    totalEntradasRealizadas += diaData.entradas_real;
    totalSaidasProjetadas += diaData.saidas_proj;
    totalSaidasRealizadas += diaData.saidas_real;

    const dataDiaStr = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

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
    curvaDiaria,
    totalEntradasProjetadas: parseFloat(totalEntradasProjetadas.toFixed(2)),
    totalEntradasRealizadas: parseFloat(totalEntradasRealizadas.toFixed(2)),
    totalSaidasProjetadas: parseFloat(totalSaidasProjetadas.toFixed(2)),
    totalSaidasRealizadas: parseFloat(totalSaidasRealizadas.toFixed(2)),
    saldoFinalProjetado: parseFloat(saldoProjetadoAcum.toFixed(2)),
    saldoFinalRealizado: parseFloat(saldoRealizadoAcum.toFixed(2)),
  };
}
