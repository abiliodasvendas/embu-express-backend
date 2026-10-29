export interface PeriodoCalculado {
  numero_periodo: number;
  data_inicio: string;
  data_fim: string;
  data_vencimento: string;
  descricao: string;
}

function formatIsoDate(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function formatBrDate(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}`;
}

export function getUltimoDiaMes(mes: number, ano: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

export function getSemanasCompetencia(mes: number, ano: number): PeriodoCalculado[] {
  const ultimoDia = getUltimoDiaMes(mes, ano);
  const semanas: PeriodoCalculado[] = [];
  let contadorPeriodo = 1;

  for (let dia = 1; dia <= ultimoDia; dia++) {
    const dataUtc = new Date(Date.UTC(ano, mes - 1, dia));
    if (dataUtc.getUTCDay() === 2) {
      const dataVencimentoStr = formatIsoDate(ano, mes, dia);

      const domingoFim = new Date(dataUtc.getTime() - 2 * 24 * 60 * 60 * 1000);
      const dataFimStr = formatIsoDate(
        domingoFim.getUTCFullYear(),
        domingoFim.getUTCMonth() + 1,
        domingoFim.getUTCDate()
      );

      const segundaInicio = new Date(domingoFim.getTime() - 6 * 24 * 60 * 60 * 1000);
      const dataInicioStr = formatIsoDate(
        segundaInicio.getUTCFullYear(),
        segundaInicio.getUTCMonth() + 1,
        segundaInicio.getUTCDate()
      );

      semanas.push({
        numero_periodo: contadorPeriodo,
        data_inicio: dataInicioStr,
        data_fim: dataFimStr,
        data_vencimento: dataVencimentoStr,
        descricao: `${contadorPeriodo}ª Semana (${formatBrDate(dataInicioStr)} a ${formatBrDate(dataFimStr)})`,
      });

      contadorPeriodo++;
    }
  }

  return semanas;
}

export function getQuinzenasCompetencia(mes: number, ano: number): PeriodoCalculado[] {
  const ultimoDia = getUltimoDiaMes(mes, ano);
  const q1Inicio = formatIsoDate(ano, mes, 1);
  const q1Fim = formatIsoDate(ano, mes, 15);
  const q1Venc = formatIsoDate(ano, mes, 16);

  const q2Inicio = formatIsoDate(ano, mes, 16);
  const q2Fim = formatIsoDate(ano, mes, ultimoDia);
  const q2Venc = formatIsoDate(ano, mes, ultimoDia);

  return [
    {
      numero_periodo: 1,
      data_inicio: q1Inicio,
      data_fim: q1Fim,
      data_vencimento: q1Venc,
      descricao: `1ª Quinzena (${formatBrDate(q1Inicio)} a ${formatBrDate(q1Fim)})`,
    },
    {
      numero_periodo: 2,
      data_inicio: q2Inicio,
      data_fim: q2Fim,
      data_vencimento: q2Venc,
      descricao: `2ª Quinzena (${formatBrDate(q2Inicio)} a ${formatBrDate(q2Fim)})`,
    },
  ];
}

export function getMensalCompetencia(
  mes: number,
  ano: number,
  diaVencimentoPadrao = 10
): PeriodoCalculado[] {
  const ultimoDia = getUltimoDiaMes(mes, ano);
  const dataInicio = formatIsoDate(ano, mes, 1);
  const dataFim = formatIsoDate(ano, mes, ultimoDia);
  const diaRealVenc = Math.min(Math.max(diaVencimentoPadrao, 1), ultimoDia);
  const dataVencimento = formatIsoDate(ano, mes, diaRealVenc);

  return [
    {
      numero_periodo: 1,
      data_inicio: dataInicio,
      data_fim: dataFim,
      data_vencimento: dataVencimento,
      descricao: `Mês Completo (${formatBrDate(dataInicio)} a ${formatBrDate(dataFim)})`,
    },
  ];
}
