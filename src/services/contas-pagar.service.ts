import { supabaseAdmin } from "../config/supabase.js";
import { despesaService } from "./despesa.service.js";
import { DespesaOperacional, FaturaFornecedorConvenio } from "../types/database.js";
import { STATUS_DESPESA, STATUS_FATURA_CONVENIO } from "../constants/financeiro.enum.js";
import { convenioAuditoriaRepository } from "../repositories/convenio-auditoria.repository.js";
import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";
import { AppError } from "../errors/AppError.js";

export interface ContaPagarItem {
  id: string;
  tipo: "DESPESA" | "CONVENIO";
  descricao: string;
  categoria: string;
  empresa_id?: number | null;
  empresa_nome?: string;
  conta_bancaria_id?: string | null;
  conta_bancaria_nome?: string;
  data_vencimento: string;
  data_pagamento?: string | null;
  valor_previsto: number;
  valor_pago: number;
  saldo_pendente: number;
  status: string;
  is_previsao: boolean;
  lote_pagamento_id?: string | null;
}

export interface ContasPagarKpis {
  total_a_pagar_mes: number;
  total_pago_mes: number;
  total_vencendo_hoje: number;
  total_atrasadas: number;
  total_semana: number;
  quantidade_pendentes: number;
  quantidade_pagas: number;
}

export interface ListContasPagarResult {
  itens: ContaPagarItem[];
  kpis: ContasPagarKpis;
}

interface FiltrosContasPagar {
  mes?: number;
  ano?: number;
  empresa_id?: number;
  status?: string;
  busca?: string;
}

export const contasPagarService = {
  async listar(filtros: FiltrosContasPagar): Promise<ListContasPagarResult> {
    const mes = filtros.mes || new Date().getMonth() + 1;
    const ano = filtros.ano || new Date().getFullYear();

    const [despesas, faturasConvenios] = await Promise.all([
      despesaService.list({
        mes,
        ano,
        empresa_id: filtros.empresa_id,
      }),
      this._buscarFaturasConvenios(mes, ano, filtros.empresa_id),
    ]);

    const itensDespesas: ContaPagarItem[] = despesas.map((d: DespesaOperacional) => {
      const valorPrevisto = Number(d.valor_previsto || 0);
      const valorPago = Number(d.valor_pago || 0);
      const isPago = d.status === STATUS_DESPESA.PAGO;
      const saldo = isPago ? 0 : Math.max(0, valorPrevisto - valorPago);

      return {
        id: d.id,
        tipo: "DESPESA",
        descricao: d.descricao,
        categoria: d.categoria,
        empresa_id: d.empresa_id,
        empresa_nome: d.empresa?.nome_fantasia || d.empresa?.razao_social,
        conta_bancaria_id: d.conta_bancaria_id,
        conta_bancaria_nome: d.conta_bancaria?.banco_nome,
        data_vencimento: d.data_vencimento,
        data_pagamento: d.data_pagamento,
        valor_previsto: valorPrevisto,
        valor_pago: valorPago,
        saldo_pendente: saldo,
        status: d.status,
        is_previsao: Boolean(d.is_previsao),
        lote_pagamento_id: d.lote_pagamento_id,
      };
    });

    const itensConvenios: ContaPagarItem[] = faturasConvenios.map((f: FaturaFornecedorConvenio) => {
      const valorPrevisto = Number(f.valor_total_fatura || 0);
      const valorPago = Number(f.valor_pago || 0);
      const isPago = f.status === STATUS_FATURA_CONVENIO.PAGA;
      const saldo = isPago ? 0 : Math.max(0, valorPrevisto - valorPago);
      const convenioNome = f.convenio?.nome || "Convênio";

      return {
        id: f.id,
        tipo: "CONVENIO",
        descricao: `Fatura Convênio: ${convenioNome}`,
        categoria: "CONVENIO",
        empresa_id: f.empresa_id,
        empresa_nome: f.empresa?.nome_fantasia || f.empresa?.razao_social,
        conta_bancaria_id: f.conta_bancaria_id,
        conta_bancaria_nome: f.conta_bancaria?.banco_nome,
        data_vencimento: f.data_vencimento,
        data_pagamento: f.data_pagamento,
        valor_previsto: valorPrevisto,
        valor_pago: valorPago,
        saldo_pendente: saldo,
        status: isPago
          ? STATUS_DESPESA.PAGO
          : f.status === STATUS_FATURA_CONVENIO.CANCELADA
          ? STATUS_DESPESA.CANCELADO
          : STATUS_DESPESA.PENDENTE,
        is_previsao: Boolean(f.is_previsao),
        lote_pagamento_id: f.lote_pagamento_id,
      };
    });

    const todosItens = [...itensDespesas, ...itensConvenios];

    const hoje = new Date();
    const hojeStr = hoje.toISOString().split("T")[0];

    const dTemp = new Date(hoje);
    const dayOfWeek = dTemp.getDay();
    const diffToMonday = dTemp.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(dTemp.setDate(diffToMonday));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayStr = monday.toISOString().split("T")[0];
    const sundayStr = sunday.toISOString().split("T")[0];

    let totalAPagarMes = 0;
    let totalPagoMes = 0;
    let totalVencendoHoje = 0;
    let totalAtrasadas = 0;
    let totalSemana = 0;
    let qtdPendentes = 0;
    let qtdPagas = 0;

    for (const item of todosItens) {
      if (item.status === STATUS_DESPESA.CANCELADO) continue;

      const isTotalPago = item.status === STATUS_DESPESA.PAGO;
      if (isTotalPago) {
        totalPagoMes += item.valor_pago || item.valor_previsto;
        qtdPagas++;
      } else {
        if (item.valor_pago > 0) {
          totalPagoMes += item.valor_pago;
        }
        totalAPagarMes += item.saldo_pendente;
        qtdPendentes++;

        if (item.data_vencimento === hojeStr) {
          totalVencendoHoje += item.saldo_pendente;
        } else if (item.data_vencimento < hojeStr) {
          totalAtrasadas += item.saldo_pendente;
        }

        if (item.data_vencimento >= mondayStr && item.data_vencimento <= sundayStr) {
          totalSemana += item.saldo_pendente;
        }
      }
    }

    const kpis: ContasPagarKpis = {
      total_a_pagar_mes: parseFloat(totalAPagarMes.toFixed(2)),
      total_pago_mes: parseFloat(totalPagoMes.toFixed(2)),
      total_vencendo_hoje: parseFloat(totalVencendoHoje.toFixed(2)),
      total_atrasadas: parseFloat(totalAtrasadas.toFixed(2)),
      total_semana: parseFloat(totalSemana.toFixed(2)),
      quantidade_pendentes: qtdPendentes,
      quantidade_pagas: qtdPagas,
    };

    let filtrados = todosItens;

    if (filtros.status && filtros.status !== "TODOS") {
      filtrados = filtrados.filter((item) => item.status === filtros.status);
    }

    if (filtros.busca) {
      const termo = filtros.busca.toLowerCase();
      filtrados = filtrados.filter(
        (item) =>
          item.descricao.toLowerCase().includes(termo) ||
          item.categoria.toLowerCase().includes(termo) ||
          (item.empresa_nome && item.empresa_nome.toLowerCase().includes(termo))
      );
    }

    filtrados.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));

    return {
      itens: filtrados,
      kpis,
    };
  },

  async _buscarFaturasConvenios(mes: number, ano: number, empresaId?: number): Promise<FaturaFornecedorConvenio[]> {
    let query = supabaseAdmin
      .from("faturas_fornecedores_convenios")
      .select("*, convenio:convenios(id, nome), empresa:empresas(id, nome_fantasia, razao_social), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta)")
      .eq("mes_competencia", mes)
      .eq("ano_competencia", ano);

    if (empresaId) {
      query = query.eq("empresa_id", empresaId);
    }

    const { data, error } = await query;
    if (error) return [];
    return (data || []) as FaturaFornecedorConvenio[];
  },

  async liquidarItem(
    id: string,
    tipo: "DESPESA" | "CONVENIO",
    payload: {
      data_pagamento: string;
      valor_pago: number;
      conta_bancaria_id: string;
    },
    criadoPor?: string
  ) {
    if (tipo === "CONVENIO") {
      const fatura = await convenioAuditoriaRepository.getFaturaById(id);
      if (!fatura) throw new AppError("Fatura de convênio não encontrada", 404);

      const conta = await contaBancariaRepository.getById(payload.conta_bancaria_id);
      if (!conta) throw new AppError("Conta bancária de liquidação não encontrada", 404);

      const novoValorPago = parseFloat((Number(fatura.valor_pago || 0) + payload.valor_pago).toFixed(2));
      const totalFatura = Number(fatura.valor_total_fatura || 0);
      const novoStatus = novoValorPago >= totalFatura ? STATUS_FATURA_CONVENIO.PAGA : STATUS_FATURA_CONVENIO.PAGO_PARCIAL;

      const faturaAtualizada = await convenioAuditoriaRepository.updateFatura(fatura.id, {
        status: novoStatus,
        data_pagamento: payload.data_pagamento,
        valor_pago: novoValorPago,
        conta_bancaria_id: payload.conta_bancaria_id,
      });

      await convenioAuditoriaRepository.createPagamento({
        fatura_fornecedor_id: fatura.id,
        conta_bancaria_id: payload.conta_bancaria_id,
        empresa_id: conta.empresa_id || fatura.empresa_id || null,
        data_pagamento: payload.data_pagamento,
        valor_pago: payload.valor_pago,
        observacao: "Liquidação individual de fatura de fornecedor",
        criado_por: criadoPor || null,
      });

      return faturaAtualizada;
    }

    return despesaService.marcarPaga(
      id,
      payload.data_pagamento,
      payload.valor_pago,
      payload.conta_bancaria_id
    );
  },
};
