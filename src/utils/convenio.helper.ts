import {
  ConvenioResumoItem,
  FaturaFornecedorConvenio,
  FaturaFornecedorPagamento,
  LancamentoConvenio,
  StatusFaturaFornecedorConvenio,
} from "../types/database.js";
import { convenioRegrasService } from "../services/convenio-regras.service.js";
import { PERIODICIDADE_FATURAMENTO } from "../constants/financeiro.enum.js";

export function gerarParcelasLancamentoConvenio(
  convenioId: string,
  lancamentoData: Omit<LancamentoConvenio, "id" | "convenio_id" | "created_at" | "updated_at">,
  quantidadeParcelas: number
) {
  const lancamentosToInsert = [];
  const baseDate = new Date(lancamentoData.data_lancamento + "T12:00:00Z");

  for (let i = 0; i < quantidadeParcelas; i++) {
    const currentDate = new Date(baseDate);
    const currentMonth = currentDate.getUTCMonth();
    currentDate.setUTCMonth(currentMonth + i);

    if (currentDate.getUTCMonth() !== (currentMonth + i) % 12) {
      currentDate.setUTCDate(0);
    }

    const dataString = currentDate.toISOString().split("T")[0];

    lancamentosToInsert.push({
      ...lancamentoData,
      convenio_id: convenioId,
      data_lancamento: dataString,
      descricao: `${lancamentoData.descricao} (Parcela ${i + 1}/${quantidadeParcelas})`,
    });
  }

  return lancamentosToInsert;
}

export function montarItemResumoConvenio(params: {
  conv: {
    id: string;
    nome: string;
    ativo: boolean;
    empresa_id: number | null;
    conta_bancaria_id: string | null;
    dia_vencimento_padrao: number;
    periodicidade: string;
  };
  convLancamentos: Array<{
    id: string;
    convenio_id: string;
    valor: number;
    moto_embu: boolean;
    colaborador_id: string | null;
    colaborador?: { id: string; nome_completo: string | null } | null;
  }>;
  fatura?: FaturaFornecedorConvenio;
  mes: number;
  ano: number;
}): {
  item: ConvenioResumoItem;
  totalConsumido: number;
  totalMotoboys: number;
  totalMotoEmbuDavid: number;
  totalSemVinculo: number;
  faturaValorReal: number;
} {
  const { conv, convLancamentos, fatura, mes, ano } = params;

  const {
    motoboys,
    totalFrotaPropria: totalMotoEmbuDavid,
    totalMotoboys,
    totalSemVinculo,
    totalGeral: totalConsumido,
  } = convenioRegrasService.classificarLancamentosConvenio(convLancamentos);

  const distinctColabs = new Set(
    motoboys
      .map((m) => m.colaborador_id)
      .filter((id): id is string => Boolean(id))
  );

  let faturaValorReal = 0;
  let faturaItem: ConvenioResumoItem["fatura_fornecedor"] = null;

  if (fatura) {
    const faturaValor = Number(fatura.valor_total_fatura || 0);
    faturaValorReal = faturaValor;
    faturaItem = {
      id: fatura.id,
      valor_total_fatura: faturaValor,
      data_vencimento: fatura.data_vencimento,
      status: fatura.status as StatusFaturaFornecedorConvenio,
      saldo_embu: parseFloat((faturaValor - totalMotoboys).toFixed(2)),
      empresa_id: fatura.empresa_id,
      conta_bancaria_id: fatura.conta_bancaria_id,
      valor_pago: fatura.valor_pago ? Number(fatura.valor_pago) : null,
      data_pagamento: fatura.data_pagamento || null,
      is_previsao: false,
      pagamentos: (fatura.pagamentos || []) as FaturaFornecedorPagamento[],
    };
  } else if (totalConsumido > 0) {
    const faturaPrevisao = convenioRegrasService.gerarFaturaPrevisao({
      convenioId: conv.id,
      mes,
      ano,
      diaVencimento: conv.dia_vencimento_padrao || 15,
      valorTotal: totalConsumido,
      empresaId: conv.empresa_id,
      contaBancariaId: conv.conta_bancaria_id,
      tipoPeriodo:
        (conv.periodicidade as "QUINZENAL" | "MENSAL" | "SEMANAL") ||
        PERIODICIDADE_FATURAMENTO.MENSAL,
    });

    faturaItem = {
      id: faturaPrevisao.id,
      valor_total_fatura: totalConsumido,
      data_vencimento: faturaPrevisao.data_vencimento,
      status: faturaPrevisao.status,
      saldo_embu: parseFloat((totalConsumido - totalMotoboys).toFixed(2)),
      empresa_id: conv.empresa_id || null,
      conta_bancaria_id: conv.conta_bancaria_id || null,
      valor_pago: null,
      data_pagamento: null,
      is_previsao: true,
      pagamentos: [],
    };
  }

  const item: ConvenioResumoItem = {
    id: conv.id,
    nome: conv.nome,
    ativo: conv.ativo,
    empresa_id: conv.empresa_id,
    conta_bancaria_id: conv.conta_bancaria_id,
    total_consumido: totalConsumido,
    total_motoboys: totalMotoboys,
    total_moto_embu_david: totalMotoEmbuDavid,
    total_sem_vinculo: totalSemVinculo,
    quantidade_lancamentos: convLancamentos.length,
    total_colaboradores_distintos: distinctColabs.size,
    ticket_medio:
      convLancamentos.length > 0
        ? parseFloat((totalConsumido / convLancamentos.length).toFixed(2))
        : 0,
    fatura_fornecedor: faturaItem,
  };

  return {
    item,
    totalConsumido,
    totalMotoboys,
    totalMotoEmbuDavid,
    totalSemVinculo,
    faturaValorReal,
  };
}
