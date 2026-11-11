import crypto from "crypto";
import { DespesaOperacional } from "../types/database.js";
import { STATUS_DESPESA } from "../constants/financeiro.enum.js";
import { despesaOperacionalSchema } from "../schemas/despesa.schema.js";
import { z } from "zod";

type CreateDespesaDTO = z.infer<typeof despesaOperacionalSchema>;

export function addMonthsFinancial(dateStr: string, monthsToAdd: number): string {
  if (monthsToAdd === 0) return dateStr;
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const novoMes = ((month - 1 + monthsToAdd) % 12) + 1;
  const novoAno = year + Math.floor((month - 1 + monthsToAdd) / 12);
  const ultimoDia = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate();
  const diaFinal = Math.min(day, ultimoDia);
  return `${novoAno}-${String(novoMes).padStart(2, "0")}-${String(diaFinal).padStart(2, "0")}`;
}

export function montarPayloadMaterializacaoDespesa(
  master: DespesaOperacional,
  mes: number,
  ano: number,
  overrides?: Partial<DespesaOperacional>,
  criadoPor?: string
) {
  const diaOriginal =
    master.dia_vencimento_base || Number(master.data_vencimento.split("-")[2]) || 10;
  const ultimoDiaDoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const diaVenc = Math.min(diaOriginal, ultimoDiaDoMes);
  const novoVencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;

  const valorPagoInicial =
    overrides?.valor_pago !== undefined
      ? overrides.valor_pago
      : overrides?.status === STATUS_DESPESA.PAGO
        ? master.valor_previsto
        : 0;

  return {
    empresa_id: master.empresa_id,
    categoria: master.categoria,
    descricao: master.descricao,
    mes_competencia: mes,
    ano_competencia: ano,
    valor_previsto: master.valor_previsto,
    data_vencimento: novoVencimento,
    data_pagamento: null,
    status: STATUS_DESPESA.PENDENTE,
    is_holding: master.is_holding,
    recorrencia_origem_id: master.id,
    is_recorrente: true,
    dia_vencimento_base: diaOriginal,
    criado_por: criadoPor || null,
    ...overrides,
    valor_pago: valorPagoInicial,
  };
}

export function gerarProjecoesDespesasRecorrentes(
  recorrentes: DespesaOperacional[],
  reais: DespesaOperacional[],
  mes: number,
  ano: number
): DespesaOperacional[] {
  const projecoes: DespesaOperacional[] = [];

  for (const rec of recorrentes) {
    if (
      rec.ano_competencia > ano ||
      (rec.ano_competencia === ano && rec.mes_competencia > mes)
    ) {
      continue;
    }

    if (rec.mes_competencia === mes && rec.ano_competencia === ano) {
      continue;
    }

    const jaExisteNoMes = reais.some((r) => r.recorrencia_origem_id === rec.id);
    if (jaExisteNoMes) {
      continue;
    }

    const diaOriginal =
      rec.dia_vencimento_base || Number(rec.data_vencimento.split("-")[2]) || 10;
    const ultimoDiaDoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const diaVenc = Math.min(diaOriginal, ultimoDiaDoMes);
    const novoVencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;

    projecoes.push({
      id: `prev_desp_${rec.id}_${mes}_${ano}`,
      empresa_id: rec.empresa_id,
      categoria: rec.categoria,
      descricao: rec.descricao,
      mes_competencia: mes,
      ano_competencia: ano,
      valor_previsto: rec.valor_previsto,
      valor_pago: 0,
      data_vencimento: novoVencimento,
      data_pagamento: null,
      status: STATUS_DESPESA.PENDENTE,
      is_holding: rec.is_holding,
      grupo_parcelamento_id: null,
      numero_parcela: null,
      total_parcelas: null,
      is_recorrente: true,
      recorrencia_origem_id: rec.id,
      dia_vencimento_base: diaOriginal,
      is_previsao: true,
      empresa: rec.empresa,
    });
  }

  return projecoes;
}

export function montarParcelasDespesa(
  data: CreateDespesaDTO,
  criadoPor?: string
): Record<string, unknown>[] {
  const totalRepeticoes = data.quantidade_parcelas!;
  const grupoId = crypto.randomUUID();
  const diaOriginal = Number(data.data_vencimento.split("-")[2]) || 10;
  const despesasParaInserir: Record<string, unknown>[] = [];

  for (let i = 1; i <= totalRepeticoes; i++) {
    const offsetMes = i - 1;
    const novoMes = ((data.mes_competencia - 1 + offsetMes) % 12) + 1;
    const novoAno =
      data.ano_competencia + Math.floor((data.mes_competencia - 1 + offsetMes) / 12);
    const ultimoDiaDoMes = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate();
    const diaVenc = Math.min(diaOriginal, ultimoDiaDoMes);
    const novoVencimento = `${novoAno}-${String(novoMes).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;

    despesasParaInserir.push({
      empresa_id: data.empresa_id,
      conta_bancaria_id: data.conta_bancaria_id || null,
      categoria: data.categoria,
      descricao: data.descricao.trim(),
      mes_competencia: novoMes,
      ano_competencia: novoAno,
      valor_previsto: data.valor_previsto,
      valor_pago: i === 1 ? data.valor_pago : 0,
      data_vencimento: novoVencimento,
      data_pagamento: i === 1 ? data.data_pagamento : null,
      status: i === 1 ? data.status : STATUS_DESPESA.PENDENTE,
      is_holding: Boolean(data.is_holding),
      grupo_parcelamento_id: grupoId,
      numero_parcela: i,
      total_parcelas: totalRepeticoes,
      is_recorrente: false,
      dia_vencimento_base: diaOriginal,
      criado_por: criadoPor || null,
    });
  }

  return despesasParaInserir;
}
