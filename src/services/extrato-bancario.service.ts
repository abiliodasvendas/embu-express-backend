import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";
import { extratoBancarioRepository } from "../repositories/extrato-bancario.repository.js";
import { categoriaFinanceiraRepository } from "../repositories/categoria-financeira.repository.js";
import { AppError } from "../errors/AppError.js";
import {
  CATEGORIA_MOVIMENTACAO_AVULSA,
  LANCAMENTO_TIPO,
  LancamentoTipo,
  ORIGEM_EXTRATO_BANCARIO,
  OrigemExtratoBancarioType,
  STATUS_DESPESA,
  TIPO_MOVIMENTACAO_AVULSA,
} from "../constants/financeiro.enum.js";
import { extractDateOnly } from "../utils/utils.js";
import { ContaBancaria } from "../types/database.js";

export type OrigemExtratoBancario = OrigemExtratoBancarioType;

export interface ExtratoBancarioItem {
  id: string;
  data: string;
  tipo: LancamentoTipo;
  origem: OrigemExtratoBancario;
  origem_label: string;
  descricao: string;
  valor: number;
  saldo_apos: number;
  movimentacao_avulsa_id?: string | null;
}

export interface ExtratoBancarioResumo {
  saldo_anterior: number;
  total_entradas: number;
  total_saidas: number;
  resultado_periodo: number;
  saldo_final: number;
}

export interface ExtratoBancarioResponse {
  conta: ContaBancaria;
  periodo: { mes: number; ano: number };
  resumo: ExtratoBancarioResumo;
  itens: ExtratoBancarioItem[];
}

interface RawMovimentacao {
  id: string;
  data: string;
  createdAt: string;
  tipo: LancamentoTipo;
  origem: OrigemExtratoBancario;
  origem_label: string;
  descricao: string;
  valor: number;
  movimentacao_avulsa_id?: string | null;
}

function unwrapSingle<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export const extratoBancarioService = {
  async getExtratoConta(
    contaId: string,
    mes: number,
    ano: number
  ): Promise<ExtratoBancarioResponse> {
    const conta = await contaBancariaRepository.getById(contaId);
    if (!conta) {
      throw new AppError("Conta bancária não encontrada", 404);
    }

    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const dataFimMes = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    const [
      {
        recebimentos,
        movAvulsas,
        despesasPagas,
        pagamentosConvenios,
        adiantamentos,
        salarios,
      },
      categoriasFinanceiras,
    ] = await Promise.all([
      extratoBancarioRepository.getMovimentacoesConta(contaId),
      categoriaFinanceiraRepository.findAll(),
    ]);

    const categoriasNomeMap = new Map(
      categoriasFinanceiras.map((c) => [c.codigo, c.nome])
    );

    const movimentacoes: RawMovimentacao[] = [];

    for (const rec of recebimentos) {
      const valor = Number(rec.valor_alocado || 0);
      if (valor <= 0) continue;
      const dataStr = extractDateOnly(rec.data_recebimento) || extractDateOnly(rec.created_at) || dataInicioMes;
      const fatura = unwrapSingle(rec.fatura);
      const clienteObj = unwrapSingle(fatura?.cliente);
      const unidadeObj = unwrapSingle(fatura?.unidade);
      const nomeCliente = clienteObj?.nome_fantasia || unidadeObj?.nome_unidade || "Cliente";
      const refComp =
        fatura?.mes_competencia && fatura?.ano_competencia
          ? ` (${String(fatura.mes_competencia).padStart(2, "0")}/${fatura.ano_competencia})`
          : "";

      movimentacoes.push({
        id: `rec_${rec.id}`,
        data: dataStr,
        createdAt: rec.created_at || dataStr,
        tipo: LANCAMENTO_TIPO.ENTRADA,
        origem: ORIGEM_EXTRATO_BANCARIO.FATURA_CLIENTE,
        origem_label: "Recebimento de Fatura",
        descricao: `Recebimento Fatura${refComp} - ${nomeCliente}`,
        valor,
      });
    }

    for (const mov of movAvulsas) {
      const valor = Number(mov.valor || 0);
      if (valor <= 0) continue;
      const dataStr = extractDateOnly(mov.data_movimentacao) || extractDateOnly(mov.created_at) || dataInicioMes;
      const isEntrada = mov.tipo_movimentacao === TIPO_MOVIMENTACAO_AVULSA.ENTRADA;
      const isTransferencia = mov.categoria === CATEGORIA_MOVIMENTACAO_AVULSA.TRANSFERENCIA_ENTRE_CONTAS;
      const catNome = categoriasNomeMap.get(mov.categoria);

      movimentacoes.push({
        id: `avulsa_${mov.id}`,
        data: dataStr,
        createdAt: mov.created_at || dataStr,
        tipo: isEntrada ? LANCAMENTO_TIPO.ENTRADA : LANCAMENTO_TIPO.SAIDA,
        origem: isTransferencia
          ? ORIGEM_EXTRATO_BANCARIO.TRANSFERENCIA_ENTRE_CONTAS
          : isEntrada
          ? ORIGEM_EXTRATO_BANCARIO.ENTRADA_AVULSA
          : ORIGEM_EXTRATO_BANCARIO.SAIDA_AVULSA,
        origem_label: isTransferencia
          ? "Transferência entre Contas"
          : catNome || (isEntrada ? "Entrada Avulsa" : "Saída Avulsa"),
        descricao: mov.descricao,
        valor,
        movimentacao_avulsa_id: mov.id,
      });
    }

    for (const desp of despesasPagas) {
      const valor = Number(
        desp.valor_pago || (desp.status === STATUS_DESPESA.PAGO ? desp.valor_previsto : 0) || 0
      );
      if (valor <= 0) continue;
      const dataStr =
        extractDateOnly(desp.data_pagamento) ||
        extractDateOnly(desp.data_vencimento) ||
        extractDateOnly(desp.created_at) ||
        dataInicioMes;

      movimentacoes.push({
        id: `desp_${desp.id}`,
        data: dataStr,
        createdAt: desp.created_at || dataStr,
        tipo: LANCAMENTO_TIPO.SAIDA,
        origem: ORIGEM_EXTRATO_BANCARIO.DESPESA,
        origem_label: categoriasNomeMap.get(desp.categoria) || "Despesa Operacional",
        descricao: desp.descricao,
        valor,
      });
    }

    for (const pag of pagamentosConvenios) {
      const valor = Number(pag.valor_pago || 0);
      if (valor <= 0) continue;
      const dataStr = extractDateOnly(pag.data_pagamento) || extractDateOnly(pag.created_at) || dataInicioMes;
      const fatura = unwrapSingle(pag.fatura);
      const convObj = unwrapSingle(fatura?.convenio);
      const nomeConvenio = convObj?.nome || "Convênio";
      const refComp =
        fatura?.mes_competencia && fatura?.ano_competencia
          ? ` (${String(fatura.mes_competencia).padStart(2, "0")}/${fatura.ano_competencia})`
          : "";

      movimentacoes.push({
        id: `conv_${pag.id}`,
        data: dataStr,
        createdAt: pag.created_at || dataStr,
        tipo: LANCAMENTO_TIPO.SAIDA,
        origem: ORIGEM_EXTRATO_BANCARIO.CONVENIO,
        origem_label: "Fatura de Convênio",
        descricao: `Fatura Convênio${refComp} - ${nomeConvenio}`,
        valor,
      });
    }

    for (const ad of adiantamentos) {
      const valor = Number(ad.valor || 0);
      if (valor <= 0) continue;
      const dataStr =
        extractDateOnly(ad.data_pagamento) ||
        extractDateOnly(ad.data_confirmacao) ||
        extractDateOnly(ad.created_at) ||
        dataInicioMes;
      const u = unwrapSingle(ad.usuario);
      const nomeColab = u?.nome_completo || "Colaborador";
      const refStr = `${String(ad.mes).padStart(2, "0")}/${ad.ano}`;

      movimentacoes.push({
        id: `vale_${ad.id}`,
        data: dataStr,
        createdAt: ad.created_at || dataStr,
        tipo: LANCAMENTO_TIPO.SAIDA,
        origem: ORIGEM_EXTRATO_BANCARIO.ADIANTAMENTO_COLABORADOR,
        origem_label: "Adiantamento (Vale)",
        descricao: `Adiantamento Salarial (Ref. ${refStr}) - ${nomeColab}`,
        valor,
      });
    }

    for (const sal of salarios) {
      const valor = Number(sal.saldo_final || 0);
      if (valor <= 0) continue;
      const dataStr =
        extractDateOnly(sal.data_pagamento) ||
        extractDateOnly(sal.created_at) ||
        dataInicioMes;
      const u = unwrapSingle(sal.usuario);
      const nomeColab = u?.nome_completo || "Colaborador";
      const refStr = `${String(sal.mes).padStart(2, "0")}/${sal.ano}`;

      movimentacoes.push({
        id: `sal_${sal.id}`,
        data: dataStr,
        createdAt: sal.created_at || dataStr,
        tipo: LANCAMENTO_TIPO.SAIDA,
        origem: ORIGEM_EXTRATO_BANCARIO.SALARIO_COLABORADOR,
        origem_label: "Salário / Fechamento",
        descricao: `Salário (Ref. ${refStr}) - ${nomeColab}`,
        valor,
      });
    }

    movimentacoes.sort((a, b) => {
      const cmpData = a.data.localeCompare(b.data);
      if (cmpData !== 0) return cmpData;
      return a.createdAt.localeCompare(b.createdAt);
    });

    let saldoAnterior = 0;
    const movsDoMes: RawMovimentacao[] = [];

    for (const m of movimentacoes) {
      if (m.data < dataInicioMes) {
        if (m.tipo === LANCAMENTO_TIPO.ENTRADA) {
          saldoAnterior += m.valor;
        } else {
          saldoAnterior -= m.valor;
        }
      } else if (m.data >= dataInicioMes && m.data <= dataFimMes) {
        movsDoMes.push(m);
      }
    }

    saldoAnterior = parseFloat(saldoAnterior.toFixed(2));
    let saldoCorrente = saldoAnterior;
    let totalEntradas = 0;
    let totalSaidas = 0;

    const itens: ExtratoBancarioItem[] = movsDoMes.map((m) => {
      const valor = parseFloat(m.valor.toFixed(2));
      if (m.tipo === LANCAMENTO_TIPO.ENTRADA) {
        totalEntradas += valor;
        saldoCorrente += valor;
      } else {
        totalSaidas += valor;
        saldoCorrente -= valor;
      }
      saldoCorrente = parseFloat(saldoCorrente.toFixed(2));

      return {
        id: m.id,
        data: m.data,
        tipo: m.tipo,
        origem: m.origem,
        origem_label: m.origem_label,
        descricao: m.descricao,
        valor,
        saldo_apos: saldoCorrente,
        movimentacao_avulsa_id: m.movimentacao_avulsa_id || null,
      };
    });

    totalEntradas = parseFloat(totalEntradas.toFixed(2));
    totalSaidas = parseFloat(totalSaidas.toFixed(2));
    const resultadoPeriodo = parseFloat((totalEntradas - totalSaidas).toFixed(2));
    const saldoFinal = parseFloat((saldoAnterior + resultadoPeriodo).toFixed(2));

    return {
      conta,
      periodo: { mes, ano },
      resumo: {
        saldo_anterior: saldoAnterior,
        total_entradas: totalEntradas,
        total_saidas: totalSaidas,
        resultado_periodo: resultadoPeriodo,
        saldo_final: saldoFinal,
      },
      itens,
    };
  },
};
