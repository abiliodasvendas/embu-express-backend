import { supabaseAdmin } from "../config/supabase.js";
import { STATUS_DESPESA } from "../constants/financeiro.enum.js";

export interface RecebimentoExtratoRow {
  id: string;
  data_recebimento: string;
  valor_alocado: number;
  observacao: string | null;
  created_at: string;
  fatura?: {
    id: string;
    numero_os: string | null;
    mes_competencia: number;
    ano_competencia: number;
    cliente?: { nome_fantasia?: string } | Array<{ nome_fantasia?: string }>;
    unidade?: { nome_unidade?: string } | Array<{ nome_unidade?: string }>;
  } | Array<{
    id: string;
    numero_os: string | null;
    mes_competencia: number;
    ano_competencia: number;
    cliente?: { nome_fantasia?: string } | Array<{ nome_fantasia?: string }>;
    unidade?: { nome_unidade?: string } | Array<{ nome_unidade?: string }>;
  }> | null;
}

export interface MovimentacaoAvulsaExtratoRow {
  id: string;
  tipo_movimentacao: string;
  categoria: string;
  descricao: string;
  valor: number;
  data_movimentacao: string;
  created_at: string;
}

export interface DespesaPagaExtratoRow {
  id: string;
  categoria: string;
  descricao: string;
  valor_previsto: number;
  valor_pago: number | null;
  data_pagamento: string | null;
  data_vencimento: string;
  status: string;
  created_at: string;
}

export interface PagamentoConvenioExtratoRow {
  id: string;
  data_pagamento: string;
  valor_pago: number;
  observacao: string | null;
  created_at: string;
  fatura?: {
    id: string;
    mes_competencia: number;
    ano_competencia: number;
    convenio?: { nome?: string } | Array<{ nome?: string }>;
  } | Array<{
    id: string;
    mes_competencia: number;
    ano_competencia: number;
    convenio?: { nome?: string } | Array<{ nome?: string }>;
  }> | null;
}

export interface AdiantamentoExtratoRow {
  id: number;
  mes: number;
  ano: number;
  valor: number | null;
  data_pagamento: string | null;
  data_confirmacao: string | null;
  created_at: string | null;
  usuario?: { nome_completo?: string } | Array<{ nome_completo?: string }> | null;
}

export interface SalarioExtratoRow {
  id: number;
  mes: number;
  ano: number;
  saldo_final: number;
  data_pagamento: string | null;
  created_at: string | null;
  usuario?: { nome_completo?: string } | Array<{ nome_completo?: string }> | null;
}

export interface MovimentacoesContaExtrato {
  recebimentos: RecebimentoExtratoRow[];
  movAvulsas: MovimentacaoAvulsaExtratoRow[];
  despesasPagas: DespesaPagaExtratoRow[];
  pagamentosConvenios: PagamentoConvenioExtratoRow[];
  adiantamentos: AdiantamentoExtratoRow[];
  salarios: SalarioExtratoRow[];
}

export const extratoBancarioRepository = {
  async getMovimentacoesConta(contaId: string): Promise<MovimentacoesContaExtrato> {
    const [
      recebimentosRes,
      movAvulsasRes,
      despesasPagasRes,
      pagamentosConveniosRes,
      adiantamentosRes,
      salariosRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("fatura_recebimentos")
        .select(
          "id, data_recebimento, valor_alocado, observacao, created_at, fatura:faturas_clientes(id, numero_os, mes_competencia, ano_competencia, cliente:clientes(nome_fantasia), unidade:unidades_cliente(nome_unidade))"
        )
        .eq("conta_bancaria_id", contaId),
      supabaseAdmin
        .from("movimentacoes_avulsas")
        .select(
          "id, tipo_movimentacao, categoria, descricao, valor, data_movimentacao, created_at"
        )
        .eq("conta_bancaria_id", contaId),
      supabaseAdmin
        .from("despesas_operacionais")
        .select(
          "id, categoria, descricao, valor_previsto, valor_pago, data_pagamento, data_vencimento, status, created_at"
        )
        .eq("conta_bancaria_id", contaId)
        .neq("status", STATUS_DESPESA.CANCELADO)
        .or(`status.eq.${STATUS_DESPESA.PAGO},valor_pago.gt.0`),
      supabaseAdmin
        .from("faturas_fornecedores_pagamentos")
        .select(
          "id, data_pagamento, valor_pago, observacao, created_at, fatura:faturas_fornecedores_convenios(id, mes_competencia, ano_competencia, convenio:convenios(nome))"
        )
        .eq("conta_bancaria_id", contaId),
      supabaseAdmin
        .from("confirmacoes_adiantamento")
        .select(
          "id, mes, ano, valor, data_pagamento, data_confirmacao, created_at, usuario:usuarios!confirmacoes_adiantamento_colaborador_id_fkey(nome_completo)"
        )
        .eq("conta_bancaria_id", contaId),
      supabaseAdmin
        .from("fechamentos_financeiros")
        .select(
          "id, mes, ano, saldo_final, data_pagamento, created_at, usuario:usuarios!fk_fechamento_colaborador(nome_completo)"
        )
        .eq("conta_bancaria_id", contaId)
        .eq("pago", true),
    ]);

    return {
      recebimentos: (recebimentosRes.data || []) as unknown as RecebimentoExtratoRow[],
      movAvulsas: (movAvulsasRes.data || []) as unknown as MovimentacaoAvulsaExtratoRow[],
      despesasPagas: (despesasPagasRes.data || []) as unknown as DespesaPagaExtratoRow[],
      pagamentosConvenios: (pagamentosConveniosRes.data || []) as unknown as PagamentoConvenioExtratoRow[],
      adiantamentos: (adiantamentosRes.data || []) as unknown as AdiantamentoExtratoRow[],
      salarios: (salariosRes.data || []) as unknown as SalarioExtratoRow[],
    };
  },
};
