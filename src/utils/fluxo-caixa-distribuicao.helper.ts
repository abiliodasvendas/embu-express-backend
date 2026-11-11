import { PontoFluxoDia } from "../services/fluxo-caixa.service.js";

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

export function calcularDesembolsoVales(params: {
  confirmacoesAtual: Array<{ colaborador_id: string; valor?: number | null }>;
  linksAtivos: Array<{ colaborador_id: string; valor_adiantamento?: number | null }>;
  diaVales: number;
  mes: number;
  ano: number;
  shareEmpresa: number;
  empresaId?: number;
}) {
  const { confirmacoesAtual, linksAtivos, shareEmpresa, empresaId } = params;

  const confirmacoesMap = new Map<string, number>();
  confirmacoesAtual.forEach((c) => {
    confirmacoesMap.set(c.colaborador_id, c.valor !== null && c.valor !== undefined ? Number(c.valor) : -1);
  });

  const valesConfiguradosMap = new Map<string, number>();
  linksAtivos.forEach((l) => {
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

  let valesDiaValesProjetado = totalValesConfirmados + totalValesPendentesTeoricos;
  let valesDiaValesRealizado = totalValesConfirmados;

  if (empresaId) {
    valesDiaValesProjetado = valesDiaValesProjetado * shareEmpresa;
    valesDiaValesRealizado = valesDiaValesRealizado * shareEmpresa;
  }

  return { valesDiaValesProjetado, valesDiaValesRealizado };
}
