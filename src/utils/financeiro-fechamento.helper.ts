import {
  DashboardLoteResultado,
  ExtratoMensal,
  StatusGeralFechamento,
} from "../types/financeiro.type.js";
import {
  ColaboradorClienteDb,
  ColaboradorElegivelMesRow,
  ConfirmacaoAdiantamentoDb,
  FechamentoFinanceiroDb,
  financeiroRepository,
} from "../repositories/financeiro.repository.js";
import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";
import { toBRTime } from "./utils.js";

export type ColaboradorElegivelMes = ColaboradorElegivelMesRow;

export interface ComponentesFolhaColaborador {
  bruto: number;
  faltas: number;
  convenios: number;
  adiantamentoPago: number;
}

export function formatFechamento<
  T extends { data_fechamento?: string; data_pagamento?: string; created_at?: string }
>(f: T): T {
  if (!f) return f;
  const result = { ...f };
  if (result.data_fechamento) result.data_fechamento = toBRTime(result.data_fechamento);
  if (result.data_pagamento) result.data_pagamento = toBRTime(result.data_pagamento);
  if (result.created_at) result.created_at = toBRTime(result.created_at);
  return result;
}

export async function obterPerfilMotoboyId(): Promise<number> {
  return financeiroRepository.obterPerfilMotoboyId();
}

export async function obterColaboradoresElegiveisMes(params: {
  mes: number;
  ano: number;
  dataInicioMesStr: string;
  dataFimMesStr: string;
}): Promise<ColaboradorElegivelMes[]> {
  return financeiroRepository.listarColaboradoresElegiveisMes(params);
}

export function extrairComponentesFolha(r: Partial<ExtratoMensal>): ComponentesFolhaColaborador {
  let colabBruto = 0;
  let colabFaltas = 0;
  let colabAdi = 0;

  (r.resumo_por_cliente || []).forEach((c) => {
    const v = c.valores_fixos;
    const baseBrutaFixa =
      Number(v?.contrato || 0) + Number(v?.ajuda_custo || 0) + Number(v?.aluguel || 0);
    const diasBase = Number(c.dias_base_mes) || 26;
    const diasEsperados = Number(c.dias_esperados_turno) || diasBase;
    const brutoVigente = (baseBrutaFixa / diasBase) * diasEsperados;
    colabBruto += brutoVigente + Number(v?.bonus || 0) + Number(c.creditos_ocorrencia || 0);

    const adi = Number(v?.adiantamento || 0);
    colabAdi += adi;
    const ausencias = Math.max(0, Number(c.debitos_ocorrencia || 0) - adi);
    colabFaltas += ausencias;
  });

  const mei = Number(r.mei_consolidado?.valor_calculado || 0);
  const credAvulso = Number(r.ocorrencias_avulsas?.creditos || 0);
  const debAvulso = Number(r.ocorrencias_avulsas?.debitos || 0);
  const conv = (r.lancamentos_convenios || []).reduce(
    (acc, l) => acc + Number(l.valor || 0),
    0
  );

  const adiantamentoEfetivo =
    r.totais?.total_adiantamento !== undefined
      ? Number(r.totais.total_adiantamento || 0)
      : colabAdi;

  return {
    bruto: colabBruto + mei + credAvulso,
    faltas: colabFaltas + debAvulso,
    convenios: conv,
    adiantamentoPago: adiantamentoEfetivo,
  };
}

export function montarStatusGeralColaboradores(params: {
  colaboradores: ColaboradorElegivelMes[];
  confirmacoes: ConfirmacaoAdiantamentoDb[];
  fechamentos: FechamentoFinanceiroDb[];
  turnos: ColaboradorClienteDb[];
  dataFimMesStr: string;
}): StatusGeralFechamento[] {
  const { colaboradores, confirmacoes, fechamentos, turnos, dataFimMesStr } = params;
  const todosTurnos = turnos.filter((t) => !t.data_inicio || t.data_inicio <= dataFimMesStr);

  const confirmacoesMap = new Map<string, ConfirmacaoAdiantamentoDb>();
  confirmacoes.forEach((c) => {
    confirmacoesMap.set(c.colaborador_id, c);
  });

  const fechamentosMap = new Map<string, FechamentoFinanceiroDb>();
  fechamentos.forEach((f) => {
    fechamentosMap.set(f.colaborador_id, f);
  });

  const turnosPorColab = new Map<string, ColaboradorClienteDb[]>();
  todosTurnos.forEach((t) => {
    if (!turnosPorColab.has(t.colaborador_id)) {
      turnosPorColab.set(t.colaborador_id, []);
    }
    turnosPorColab.get(t.colaborador_id)!.push(t);
  });

  return (colaboradores || []).map((colab) => {
    const confirmacao = confirmacoesMap.get(colab.id);
    const fechamento = fechamentosMap.get(colab.id);
    const turnosColab = turnosPorColab.get(colab.id) || [];

    const adiantamentoConfirmado = Boolean(confirmacao);
    const pago = Boolean(fechamento);

    const valorAdiantamentoConfigurado = turnosColab.reduce(
      (acc, t) => acc + (t.valor_adiantamento || 0),
      0
    );

    const valorAdiantamentoConfirmado = confirmacao
      ? confirmacao.valor !== null && confirmacao.valor !== undefined
        ? Number(confirmacao.valor)
        : valorAdiantamentoConfigurado
      : null;

    const valorFinal = fechamento ? fechamento.saldo_final || 0 : 0;

    const clientes = turnosColab
      .map((t) => {
        if (!t.cliente) return null;
        if (Array.isArray(t.cliente)) {
          return t.cliente[0]?.nome_fantasia;
        }
        return t.cliente.nome_fantasia;
      })
      .filter((nome): nome is string => Boolean(nome));
    const clientesUnicos = [...new Set(clientes)];

    return {
      colaborador_id: colab.id,
      nome_completo: colab.nome_completo || "",
      email: colab.email || "",
      status_cadastro: colab.status || CADASTRO_STATUS.ATIVO,
      adiantamento_confirmado: adiantamentoConfirmado,
      data_confirmacao_adiantamento: confirmacao
        ? toBRTime(confirmacao.data_confirmacao)
        : null,
      pago,
      data_pagamento: fechamento ? toBRTime(fechamento.data_pagamento) : null,
      valor_adiantamento_configurado: valorAdiantamentoConfigurado,
      valor_adiantamento_confirmado: valorAdiantamentoConfirmado,
      valor_final: parseFloat(valorFinal.toFixed(2)),
      clientes: clientesUnicos,
    };
  });
}

export function montarDashboardLoteVazio(): DashboardLoteResultado {
  return {
    totalFolha: 0,
    valorPago: 0,
    restaPagar: 0,
    pendentesCount: 0,
    pagosCount: 0,
    totalColaboradores: 0,
    totalFolhaBruta: 0,
    totalDescontoFaltas: 0,
    totalDescontoConvenios: 0,
    totalAdiantamentoPago: 0,
    totalAdiantamentoPrevisto: 0,
    colaboradoresAdiantamentoCount: 0,
    saldoFinalFolha: 0,
  };
}

export function formatarResultadoDashboardLote(params: {
  valorPago: number;
  restaPagar: number;
  pendentesCount: number;
  pagosCount: number;
  totalFolhaBruta: number;
  totalDescontoFaltas: number;
  totalDescontoConvenios: number;
  totalAdiantamentoPago: number;
  adiantamentoPendenteConfigurado: number;
  colaboradoresAdiantamentoCount: number;
}): DashboardLoteResultado {
  const {
    valorPago,
    restaPagar,
    pendentesCount,
    pagosCount,
    totalDescontoFaltas,
    totalDescontoConvenios,
    totalAdiantamentoPago,
    adiantamentoPendenteConfigurado,
    colaboradoresAdiantamentoCount,
  } = params;

  const totalFolha = valorPago + restaPagar;
  const totalDescontosTotal = totalDescontoFaltas + totalDescontoConvenios;
  const folhaBrutaReconciliada = totalFolha + totalDescontosTotal + totalAdiantamentoPago;
  const totalAdiantamentoPrevisto = totalAdiantamentoPago + adiantamentoPendenteConfigurado;

  return {
    totalFolha: parseFloat(totalFolha.toFixed(2)),
    valorPago: parseFloat(valorPago.toFixed(2)),
    restaPagar: parseFloat(restaPagar.toFixed(2)),
    pendentesCount,
    pagosCount,
    totalColaboradores: pagosCount + pendentesCount,
    totalFolhaBruta: parseFloat(folhaBrutaReconciliada.toFixed(2)),
    totalDescontoFaltas: parseFloat(totalDescontoFaltas.toFixed(2)),
    totalDescontoConvenios: parseFloat(totalDescontoConvenios.toFixed(2)),
    totalAdiantamentoPago: parseFloat(totalAdiantamentoPago.toFixed(2)),
    totalAdiantamentoPrevisto: parseFloat(totalAdiantamentoPrevisto.toFixed(2)),
    colaboradoresAdiantamentoCount,
    saldoFinalFolha: parseFloat(totalFolha.toFixed(2)),
  };
}
