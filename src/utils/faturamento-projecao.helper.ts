import { FaturaCliente, Empresa } from "../types/database.js";
import {
  ListFaturasFilters,
  UnidadeParaMedicao,
  UnidadeAtivaContrato,
} from "../repositories/faturamento.repository.js";
import {
  STATUS_FATURA,
  PERIODICIDADE_FATURAMENTO,
  TIPO_PERIODO_FATURA,
} from "../constants/financeiro.enum.js";
import {
  getQuinzenasCompetencia,
  getMensalCompetencia,
  getSemanasCompetencia,
  PeriodoCalculado,
} from "./periodo-faturamento.helper.js";

export function calcularValoresSugestaoMedicao(params: {
  unidade: UnidadeParaMedicao;
  mes: number;
  ano: number;
  tipoPeriodo?: string;
  numeroPeriodo?: number;
  quinzena?: number | null;
}) {
  const { unidade, mes, ano, tipoPeriodo, numeroPeriodo, quinzena } = params;
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
}

export function montarPayloadsCancelamentoPrevisoes(
  prevIds: string[],
  unidades: UnidadeParaMedicao[],
  empresas: Array<{ id: number }>,
  criadoPor?: string
): Record<string, unknown>[] {
  const parsedPrevs = prevIds.map((prevId) => {
    const parts = prevId.split("_");
    return {
      unidadeId: Number(parts[1]),
      mes: Number(parts[2]),
      ano: Number(parts[3]),
      numPeriodo: Number(parts[4]),
    };
  });

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

  return recordsToInsert;
}

export function montarPayloadMaterializacao(
  unidade: UnidadeParaMedicao,
  mes: number,
  ano: number,
  numPeriodo: number,
  empresaId: number,
  overrides?: Partial<FaturaCliente>,
  criadoPor?: string
) {
  const periodicidade = unidade.periodicidade || PERIODICIDADE_FATURAMENTO.QUINZENAL;
  const valorCadastrado = Number(unidade.valor_contrato_mensal || 0);

  let periodosCalculados: PeriodoCalculado[] = [];
  let tipoPeriodo: string = periodicidade;
  let quinzena: number | null = null;
  let valorFaturado = valorCadastrado;

  if (periodicidade === PERIODICIDADE_FATURAMENTO.SEMANAL) {
    periodosCalculados = getSemanasCompetencia(mes, ano);
    tipoPeriodo = TIPO_PERIODO_FATURA.SEMANAL;
    valorFaturado = valorCadastrado;
  } else if (periodicidade === PERIODICIDADE_FATURAMENTO.MENSAL) {
    periodosCalculados = getMensalCompetencia(mes, ano, unidade.dia_vencimento_padrao || 10);
    tipoPeriodo = TIPO_PERIODO_FATURA.MENSAL;
    valorFaturado = valorCadastrado;
  } else {
    periodosCalculados = getQuinzenasCompetencia(
      mes,
      ano,
      unidade.dia_vencimento_padrao,
      unidade.dia_vencimento_segunda_quinzena
    );
    tipoPeriodo = TIPO_PERIODO_FATURA.QUINZENAL;
    quinzena = numPeriodo;
    if (numPeriodo === 1) {
      valorFaturado = Math.round((valorCadastrado / 2) * 100) / 100;
    } else {
      const v1 = Math.round((valorCadastrado / 2) * 100) / 100;
      valorFaturado = parseFloat((valorCadastrado - v1).toFixed(2));
    }
  }

  const periodoEncontrado =
    periodosCalculados.find((p) => p.numero_periodo === numPeriodo) ||
    periodosCalculados[0];

  const record = {
    cliente_id: unidade.cliente_id,
    unidade_id: unidade.id,
    empresa_id: empresaId,
    mes_competencia: mes,
    ano_competencia: ano,
    quinzena: quinzena ?? (tipoPeriodo === TIPO_PERIODO_FATURA.QUINZENAL ? numPeriodo : (numPeriodo || 1)),
    tipo_periodo: tipoPeriodo,
    numero_periodo: numPeriodo,
    data_inicio_apuracao: periodoEncontrado
      ? periodoEncontrado.data_inicio
      : `${ano}-${String(mes).padStart(2, "0")}-01`,
    data_fim_apuracao: periodoEncontrado
      ? periodoEncontrado.data_fim
      : `${ano}-${String(mes).padStart(2, "0")}-15`,
    valor_faturado: valorFaturado,
    valor_pago: 0,
    data_emissao: new Date().toISOString().split("T")[0],
    data_vencimento: periodoEncontrado
      ? periodoEncontrado.data_vencimento
      : `${ano}-${String(mes).padStart(2, "0")}-16`,
    status: STATUS_FATURA.PENDENTE,
    dias_esperados: 0,
    dias_trabalhados: 0,
    faltas_sem_cobertura: 0,
    observacoes: "Previsão contratual da unidade.",
    criado_por: criadoPor || null,
    ...overrides,
  };

  if (record.quinzena === null || record.quinzena === undefined) {
    record.quinzena = record.numero_periodo || 1;
  }

  return record;
}

export function gerarProjecoesVirtuais(
  unidades: UnidadeAtivaContrato[],
  faturasReais: FaturaCliente[],
  empresas: Array<{ id: number; nome_fantasia: string; razao_social?: string; cnpj?: string }>,
  filtros: ListFaturasFilters,
  mes: number,
  ano: number
): FaturaCliente[] {
  const empresasMap = new Map((empresas || []).map((e) => [e.id, e]));
  const fallbackEmpresa = empresas[0] || { id: 1, nome_fantasia: "Embu Express", razao_social: "Embu Express", cnpj: "" };

  const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const targetMonthEnd = new Date(Date.UTC(ano, mes - 1, ultimoDiaMes, 23, 59, 59));

  const projecoes: FaturaCliente[] = [];

  for (const unidade of unidades) {
    if (unidade.created_at) {
      const dataCadastro = new Date(unidade.created_at);
      if (dataCadastro > targetMonthEnd) {
        continue;
      }
    }

    if (filtros.empresa_id && unidade.empresa_emissora_padrao_id && unidade.empresa_emissora_padrao_id !== filtros.empresa_id) {
      continue;
    }

    const periodicidade = unidade.periodicidade || PERIODICIDADE_FATURAMENTO.QUINZENAL;
    const valorMensal = Number(unidade.valor_contrato_mensal || 0);

    const empresaObj = (unidade.empresa_emissora_padrao_id
      ? empresasMap.get(unidade.empresa_emissora_padrao_id)
      : null) || fallbackEmpresa;

    let periodosDaUnidade: PeriodoCalculado[] = [];
    let tipoPeriodoFinal: string = periodicidade;

    if (periodicidade === PERIODICIDADE_FATURAMENTO.SEMANAL) {
      if (filtros.tipo_periodo && filtros.tipo_periodo !== TIPO_PERIODO_FATURA.SEMANAL) continue;
      periodosDaUnidade = getSemanasCompetencia(mes, ano);
      tipoPeriodoFinal = TIPO_PERIODO_FATURA.SEMANAL;
    } else if (periodicidade === PERIODICIDADE_FATURAMENTO.MENSAL) {
      if (filtros.tipo_periodo && filtros.tipo_periodo !== TIPO_PERIODO_FATURA.MENSAL) continue;
      periodosDaUnidade = getMensalCompetencia(mes, ano, unidade.dia_vencimento_padrao || 10);
      tipoPeriodoFinal = TIPO_PERIODO_FATURA.MENSAL;
    } else {
      if (filtros.tipo_periodo && filtros.tipo_periodo !== TIPO_PERIODO_FATURA.QUINZENAL) continue;
      periodosDaUnidade = getQuinzenasCompetencia(
        mes,
        ano,
        unidade.dia_vencimento_padrao,
        unidade.dia_vencimento_segunda_quinzena
      );
      tipoPeriodoFinal = TIPO_PERIODO_FATURA.QUINZENAL;
    }

    for (const p of periodosDaUnidade) {
      if (filtros.numero_periodo && filtros.numero_periodo !== p.numero_periodo) {
        continue;
      }
      if (
        tipoPeriodoFinal === TIPO_PERIODO_FATURA.QUINZENAL &&
        filtros.quinzena &&
        filtros.quinzena !== p.numero_periodo
      ) {
        continue;
      }

      const existeReal = faturasReais.some(
        (f) =>
          f.unidade_id === unidade.id &&
          f.tipo_periodo === tipoPeriodoFinal &&
          (f.numero_periodo === p.numero_periodo ||
            (tipoPeriodoFinal === TIPO_PERIODO_FATURA.QUINZENAL && f.quinzena === p.numero_periodo))
      );

      if (!existeReal) {
        let valorPeriodo = valorMensal;
        if (tipoPeriodoFinal === TIPO_PERIODO_FATURA.QUINZENAL) {
          const q1Val = Math.round((valorMensal / 2) * 100) / 100;
          valorPeriodo =
            p.numero_periodo === 1 ? q1Val : parseFloat((valorMensal - q1Val).toFixed(2));
        }

        projecoes.push({
          id: `prev_${unidade.id}_${mes}_${ano}_${p.numero_periodo}`,
          cliente_id: unidade.cliente_id,
          unidade_id: unidade.id,
          empresa_id: empresaObj.id,
          mes_competencia: mes,
          ano_competencia: ano,
          quinzena: tipoPeriodoFinal === TIPO_PERIODO_FATURA.QUINZENAL ? p.numero_periodo : undefined,
          tipo_periodo: tipoPeriodoFinal,
          numero_periodo: p.numero_periodo,
          data_inicio_apuracao: p.data_inicio,
          data_fim_apuracao: p.data_fim,
          valor_faturado: valorPeriodo,
          valor_pago: 0,
          data_emissao: `${ano}-${String(mes).padStart(2, "0")}-01`,
          data_vencimento: p.data_vencimento,
          status: STATUS_FATURA.PENDENTE,
          dias_esperados: 0,
          dias_trabalhados: 0,
          faltas_sem_cobertura: 0,
          observacoes: "Previsão contratual da unidade",
          is_previsao: true,
          cliente: { id: unidade.cliente_id, nome_fantasia: unidade.cliente?.nome_fantasia || "Cliente" },
          unidade: {
            id: unidade.id,
            nome_unidade: unidade.nome_unidade,
            cnpj: unidade.cnpj,
            valor_contrato_mensal: unidade.valor_contrato_mensal,
            conta_bancaria_padrao_id: unidade.conta_bancaria_padrao_id,
          },
          empresa: empresaObj,
          recebimentos: [],
        } as unknown as FaturaCliente);
      }
    }
  }

  return projecoes;
}
