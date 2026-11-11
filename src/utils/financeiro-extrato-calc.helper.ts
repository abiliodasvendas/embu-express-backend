import {
  CALENDARIO_STATUS,
  CalendarioStatus,
  FINANCEIRO_STATUS,
  LANCAMENTO_TIPO,
} from "../constants/financeiro.enum.js";
import { LancamentoConvenio, Ocorrencia } from "../types/database.js";
import { DiaCalendarioVisual, ExtratoMensal, ResumoClienteFinanceiro } from "../types/financeiro.type.js";
import { extractDateOnly, toLocalDateString } from "./utils.js";

export type { DiaCalendarioVisual };

export interface LinkColaboradorExtrato {
  id?: number;
  cliente_id?: number;
  unidade_id?: number;
  data_inicio?: string | null;
  data_fim?: string | null;
  created_at?: string | null;
  valor_contrato?: number | null;
  valor_bonus?: number | null;
  ajuda_custo?: number | null;
  valor_aluguel?: number | null;
  valor_adiantamento?: number | null;
  taxa_entrega?: number | null;
  cliente?: { nome_fantasia?: string } | Array<{ nome_fantasia?: string }> | null;
  unidade?: { nome_unidade?: string } | Array<{ nome_unidade?: string }> | null;
  horarios?: Array<{ dia_semana?: number }>;
}

export interface PontoExtratoItem {
  colaborador_cliente_id?: number | null;
  data_referencia?: string;
}

export interface ConfirmacaoAdiantamentoExtratoItem {
  valor?: number | null;
  conta_bancaria_id?: string | null;
  data_pagamento?: string | null;
}

export interface LancamentoConvenioExtratoItem {
  valor?: number | string | null;
}

export function calcularMatematicaExtrato(dados: {
  usuarioId: string;
  mes: number;
  ano: number;
  usuario: { valor_mei: number | null } | null;
  links: LinkColaboradorExtrato[];
  ocorrencias: Ocorrencia[];
  fechamentoAnterior: { saldo_final: number } | null;
  pontos: PontoExtratoItem[];
  feriadosMes: Set<string>;
  confirmacaoAdiantamento: ConfirmacaoAdiantamentoExtratoItem | null;
  lancamentosConvenios: LancamentoConvenioExtratoItem[];
}): ExtratoMensal {
  const {
    usuarioId,
    mes,
    ano,
    usuario,
    links,
    ocorrencias,
    fechamentoAnterior,
    pontos,
    feriadosMes,
    confirmacaoAdiantamento,
    lancamentosConvenios,
  } = dados;

  const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

  let mesAnterior = mes - 1;
  let anoAnterior = ano;
  if (mesAnterior === 0) {
    mesAnterior = 12;
    anoAnterior = ano - 1;
  }

  if (fechamentoAnterior && fechamentoAnterior.saldo_final < 0) {
    const valorDebito = Math.abs(fechamentoAnterior.saldo_final);
    ocorrencias.push({
      is_virtual: true,
      colaborador_id: usuarioId,
      tipo_id: 0,
      data_ocorrencia: dataInicioMesStr,
      valor: valorDebito,
      impacto_financeiro: true,
      tipo_lancamento: LANCAMENTO_TIPO.SAIDA,
      observacao: `Saldo devedor acumulado de ${String(mesAnterior).padStart(2, "0")}/${anoAnterior}`,
      tipo: { descricao: "Saldo Devedor (Mês Anterior)" },
    } as Ocorrencia);
  }

  const adiantamentoConfirmado = Boolean(confirmacaoAdiantamento);
  const valorAdiantamentoCustom =
    confirmacaoAdiantamento &&
    confirmacaoAdiantamento.valor !== null &&
    confirmacaoAdiantamento.valor !== undefined
      ? Number(confirmacaoAdiantamento.valor)
      : null;

  const linksVigentesNoMes = (links || []).filter((link) => {
    const dIni = extractDateOnly(link.data_inicio) || extractDateOnly(link.created_at);
    const dFim = extractDateOnly(link.data_fim);
    return (!dIni || dIni <= dataFimMesStr) && (!dFim || dFim >= dataInicioMesStr);
  });

  const somaAdiantamentoConfigurado = linksVigentesNoMes.reduce(
    (acc, link) => acc + (link.valor_adiantamento || 0),
    0
  );
  let valorAdiantamentoDistribuidoAcumulado = 0;

  const hojeLocalStr = toLocalDateString();

  const resumoClientes = (links || [])
    .map((link) => {
      const dataInicioStr = extractDateOnly(link.data_inicio) || extractDateOnly(link.created_at);
      const dataFimStr = extractDateOnly(link.data_fim);

      const isShiftInMonth =
        (!dataInicioStr || dataInicioStr <= dataFimMesStr) &&
        (!dataFimStr || dataFimStr >= dataInicioMesStr);
      const pontosDesteTurnoRaw = (pontos || []).filter(
        (p) => p.colaborador_cliente_id === link.id
      );
      if (!isShiftInMonth && pontosDesteTurnoRaw.length === 0) {
        return null;
      }

      let diasEscalaNoMesTotal = 0;
      let diasEsperadosTurno = 0;
      let ausenciasTurno = 0;
      const calendarioVisual: DiaCalendarioVisual[] = [];

      for (let d = 1; d <= ultimoDiaMes; d++) {
        const dataAtual = new Date(Date.UTC(ano, mes - 1, d));
        const dataReferenciaStr = dataAtual.toISOString().split("T")[0];
        const diaSemana = dataAtual.getUTCDay();

        const isDiaEscala = Boolean(
          link.horarios && link.horarios.some((h) => h.dia_semana === diaSemana)
        );
        const isVigente =
          (!dataInicioStr || dataReferenciaStr >= dataInicioStr) &&
          (!dataFimStr || dataReferenciaStr <= dataFimStr);
        const isFuturoOuHoje = dataReferenciaStr >= hojeLocalStr;

        if (isDiaEscala) {
          diasEscalaNoMesTotal++;
          if (isVigente) diasEsperadosTurno++;
        }

        let status: CalendarioStatus = CALENDARIO_STATUS.NAO_VIGENTE;
        if (isVigente) {
          const temPonto = (pontos || []).some(
            (p) =>
              p.data_referencia === dataReferenciaStr && p.colaborador_cliente_id === link.id
          );
          const isFeriado = feriadosMes.has(dataReferenciaStr);

          if (temPonto) {
            status = CALENDARIO_STATUS.TRABALHADO;
          } else if (isFuturoOuHoje) {
            status = CALENDARIO_STATUS.FUTURO;
          } else if (isDiaEscala) {
            if (isFeriado) {
              status = CALENDARIO_STATUS.FERIADO;
            } else {
              status = CALENDARIO_STATUS.SEM_ATIVIDADE;
              ausenciasTurno++;
            }
          } else {
            status = CALENDARIO_STATUS.NAO_VIGENTE;
          }
        }

        if (isDiaEscala) {
          const diasSemanaNomes = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
          const diasSemanaNomesLongos = [
            "Domingo",
            "Segunda-feira",
            "Terça-feira",
            "Quarta-feira",
            "Quinta-feira",
            "Sexta-feira",
            "Sábado",
          ];

          calendarioVisual.push({
            data: dataReferenciaStr,
            data_br: dataReferenciaStr.split("-").reverse().join("/"),
            dia: d,
            dia_semana_curto: diasSemanaNomes[diaSemana],
            dia_semana_longo: diasSemanaNomesLongos[diaSemana],
            status,
            is_dia_escala: isDiaEscala,
          });
        }
      }

      if (diasEscalaNoMesTotal === 0) return null;
      if (diasEsperadosTurno === 0 && pontosDesteTurnoRaw.length === 0) return null;

      const pontosDesteTurno = (pontos || []).filter((p) => {
        if (p.colaborador_cliente_id !== link.id) return false;
        if (dataInicioStr && p.data_referencia && p.data_referencia < dataInicioStr) return false;
        if (dataFimStr && p.data_referencia && p.data_referencia > dataFimStr) return false;
        return true;
      });

      const diasTrabalhados = new Set(pontosDesteTurno.map((p) => p.data_referencia)).size;
      const bonusEfetivo =
        diasEsperadosTurno > 0 && ausenciasTurno === 0 ? link.valor_bonus || 0 : 0;
      const isVigenteNoMes = isShiftInMonth;
      const valorAdiantamentoConfig = isVigenteNoMes ? link.valor_adiantamento || 0 : 0;
      let valorAdiantamentoEfetivo = 0;

      if (adiantamentoConfirmado) {
        if (valorAdiantamentoCustom !== null) {
          if (isVigenteNoMes) {
            const indexVigente = linksVigentesNoMes.findIndex((l) => l.id === link.id);
            const isUltimoVigente = indexVigente === linksVigentesNoMes.length - 1;

            if (somaAdiantamentoConfigurado > 0) {
              if (isUltimoVigente) {
                valorAdiantamentoEfetivo = Math.max(
                  0,
                  parseFloat(
                    (valorAdiantamentoCustom - valorAdiantamentoDistribuidoAcumulado).toFixed(2)
                  )
                );
              } else {
                const proporcao = valorAdiantamentoConfig / somaAdiantamentoConfigurado;
                valorAdiantamentoEfetivo = parseFloat(
                  (valorAdiantamentoCustom * proporcao).toFixed(2)
                );
                valorAdiantamentoDistribuidoAcumulado += valorAdiantamentoEfetivo;
              }
            } else {
              valorAdiantamentoEfetivo = indexVigente === 0 ? valorAdiantamentoCustom : 0;
            }
          }
        } else {
          valorAdiantamentoEfetivo = valorAdiantamentoConfig;
        }
      }

      const baseBrutaFixa =
        (link.valor_contrato || 0) + (link.ajuda_custo || 0) + (link.valor_aluguel || 0);
      const valorDia = baseBrutaFixa / diasEscalaNoMesTotal;
      const virtualOcorrenciasTurno: Ocorrencia[] = [];
      const datasAusencia: string[] = [];

      calendarioVisual.forEach((dia) => {
        if (dia.status === CALENDARIO_STATUS.SEM_ATIVIDADE) {
          datasAusencia.push(dia.data);
          virtualOcorrenciasTurno.push({
            is_virtual: true,
            colaborador_id: usuarioId,
            colaborador_cliente_id: link.id,
            tipo_id: 0,
            data_ocorrencia: dia.data,
            valor: parseFloat(valorDia.toFixed(2)),
            impacto_financeiro: true,
            tipo_lancamento: LANCAMENTO_TIPO.SAIDA,
            observacao: `Sem Atividade - ${dia.dia_semana_curto}`,
            tipo: { descricao: "Sem Atividade" },
          });
        }
      });

      if (valorAdiantamentoEfetivo > 0) {
        virtualOcorrenciasTurno.push({
          is_virtual: true,
          colaborador_id: usuarioId,
          colaborador_cliente_id: link.id,
          tipo_id: 0,
          data_ocorrencia: dataFimMesStr,
          valor: valorAdiantamentoEfetivo,
          impacto_financeiro: true,
          tipo_lancamento: LANCAMENTO_TIPO.SAIDA,
          observacao: "Adiantamento Mensal",
          tipo: { descricao: "Adiantamento" },
        });
      }

      const todasOcorrenciasTurno = [
        ...ocorrencias.filter(
          (o) => o.colaborador_cliente_id === link.id && o.impacto_financeiro
        ),
        ...virtualOcorrenciasTurno,
      ];

      const totalCreditosTurno = todasOcorrenciasTurno
        .filter((o) => o.tipo_lancamento === LANCAMENTO_TIPO.ENTRADA)
        .reduce((acc, o) => acc + (o.valor || 0), 0);
      const totalDebitosTurno = todasOcorrenciasTurno
        .filter((o) => o.tipo_lancamento === LANCAMENTO_TIPO.SAIDA)
        .reduce((acc, o) => acc + (o.valor || 0), 0);

      const valorBrutoVigente = (baseBrutaFixa / diasEscalaNoMesTotal) * diasEsperadosTurno;
      const valorFinalCalculado =
        valorBrutoVigente + bonusEfetivo + totalCreditosTurno - totalDebitosTurno;

      const clienteObj = Array.isArray(link.cliente) ? link.cliente[0] : link.cliente;
      const unidadeObj = Array.isArray(link.unidade) ? link.unidade[0] : link.unidade;

      return {
        cliente_id: Number(link.cliente_id || 0),
        unidade_id: link.unidade_id,
        nome_fantasia: clienteObj?.nome_fantasia,
        nome_unidade: unidadeObj?.nome_unidade,
        id_vinculo: Number(link.id || 0),
        saldo_fixo_original: baseBrutaFixa - valorAdiantamentoEfetivo + bonusEfetivo,
        valores_fixos: {
          contrato: link.valor_contrato || 0,
          bonus: bonusEfetivo,
          bonus_config: link.valor_bonus || 0,
          ajuda_custo: link.ajuda_custo || 0,
          aluguel: link.valor_aluguel || 0,
          adiantamento: valorAdiantamentoEfetivo,
          adiantamento_config: valorAdiantamentoConfig,
          taxa_entrega: link.taxa_entrega || 0,
        },
        dias_base_mes: diasEscalaNoMesTotal,
        dias_esperados_turno: diasEsperadosTurno,
        dias_trabalhados: diasTrabalhados,
        ausencias: ausenciasTurno,
        calendario_visual: calendarioVisual,
        data_inicio: link.data_inicio || null,
        data_fim: link.data_fim || null,
        creditos_ocorrencia: totalCreditosTurno,
        debitos_ocorrencia: totalDebitosTurno,
        valor_calculado: parseFloat(valorFinalCalculado.toFixed(2)),
        datas_ausencia: datasAusencia,
        _virtual_ocorrencias: virtualOcorrenciasTurno,
      };
    })
    .filter((r): r is Exclude<typeof r, null> => r !== null);

  const ocorrenciasComFeriadoMarcado = (ocorrencias || []).map((o) => {
    const ehAutomatica = o.observacao?.includes("Inclusão automática:");
    if (ehAutomatica) return { ...o, is_virtual: true };
    return o;
  });

  const virtualOcorrenciasGlobais = resumoClientes.flatMap(
    (r) => r._virtual_ocorrencias || []
  );
  const todasOcorrencias = [
    ...ocorrenciasComFeriadoMarcado,
    ...virtualOcorrenciasGlobais,
  ].sort((a, b) => b.data_ocorrencia.localeCompare(a.data_ocorrencia));

  const resumoPorClienteLimpo = resumoClientes.map(
    ({ _virtual_ocorrencias: _ignored, ...rest }) => rest
  );

  const valorMeiTotal = usuario?.valor_mei || 0;
  let proRataMeiFinal = 0;
  let diasAtivosUnicos: string[] = [];
  let diasBaseReferencia = 26;

  if (valorMeiTotal > 0) {
    const datasComPonto = [
      ...new Set((pontos || []).map((p) => p.data_referencia).filter((d): d is string => Boolean(d))),
    ];

    const datasEscalaEsperada = new Set<string>();
    resumoPorClienteLimpo.forEach((r) => {
      r.calendario_visual.forEach((dia) => {
        if (dia.is_dia_escala && dia.status !== CALENDARIO_STATUS.NAO_VIGENTE) {
          datasEscalaEsperada.add(dia.data);
        }
      });
    });

    if (resumoPorClienteLimpo.length > 0) {
      diasBaseReferencia = resumoPorClienteLimpo[0].dias_base_mes;
    }

    const diasParaCobrancaMei = datasEscalaEsperada.size;
    proRataMeiFinal = (valorMeiTotal / diasBaseReferencia) * diasParaCobrancaMei;

    if (proRataMeiFinal > valorMeiTotal) proRataMeiFinal = valorMeiTotal;

    diasAtivosUnicos = datasComPonto.sort();
  }

  const ocorrenciasAvulsas = ocorrencias.filter(
    (o) => !o.colaborador_cliente_id && o.impacto_financeiro
  );
  const creditosAvulsos = ocorrenciasAvulsas
    .filter((o) => o.tipo_lancamento === LANCAMENTO_TIPO.ENTRADA)
    .reduce((acc, o) => acc + (o.valor || 0), 0);
  const debitosAvulsos = ocorrenciasAvulsas
    .filter((o) => o.tipo_lancamento === LANCAMENTO_TIPO.SAIDA)
    .reduce((acc, o) => acc + (o.valor || 0), 0);
  const saldoAvulso = creditosAvulsos - debitosAvulsos;

  const totalTurnos = resumoPorClienteLimpo.reduce(
    (acc, r) => acc + (r.valor_calculado || 0),
    0
  );
  const totalAdiantamento = adiantamentoConfirmado
    ? valorAdiantamentoCustom !== null
      ? valorAdiantamentoCustom
      : resumoPorClienteLimpo.reduce(
          (acc, r) => acc + (r.valores_fixos.adiantamento || 0),
          0
        )
    : 0;
  const debitosConvenios = (lancamentosConvenios || []).reduce(
    (acc, l) => acc + Number(l.valor || 0),
    0
  );
  const saldoFinal = totalTurnos + proRataMeiFinal + saldoAvulso - debitosConvenios;

  return {
    periodo: { mes, ano },
    status: FINANCEIRO_STATUS.RASCUNHO,
    adiantamento_confirmado: adiantamentoConfirmado,
    adiantamento_conta_bancaria_id: confirmacaoAdiantamento?.conta_bancaria_id || null,
    adiantamento_data_pagamento: confirmacaoAdiantamento?.data_pagamento || null,
    resumo_por_cliente: resumoPorClienteLimpo as ResumoClienteFinanceiro[],
    mei_consolidado: {
      valor_original: valorMeiTotal,
      valor_calculado: parseFloat(proRataMeiFinal.toFixed(2)),
      dias_base: diasBaseReferencia,
      dias_trabalhados: diasAtivosUnicos.length,
      datas_trabalhadas: diasAtivosUnicos,
    },
    ocorrencias: todasOcorrencias,
    ocorrencias_avulsas: {
      creditos: creditosAvulsos,
      debitos: debitosAvulsos,
      saldo: parseFloat(saldoAvulso.toFixed(2)),
    },
    lancamentos_convenios: lancamentosConvenios as unknown as LancamentoConvenio[],
    totais: {
      total_turnos: parseFloat(totalTurnos.toFixed(2)),
      total_mei: parseFloat(proRataMeiFinal.toFixed(2)),
      total_avulso: parseFloat(saldoAvulso.toFixed(2)),
      total_adiantamento: totalAdiantamento,
      saldo_final: parseFloat(saldoFinal.toFixed(2)),
    },
  };
}
