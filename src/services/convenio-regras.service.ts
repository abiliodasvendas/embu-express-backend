import { DAVID_CAITITE_ID, STATUS_FATURA_CONVENIO } from "../constants/financeiro.enum.js";
import { FaturaFornecedorConvenio } from "../types/database.js";

export interface LancamentoConvenioItem {
  valor: number;
  moto_embu?: boolean | null;
  colaborador_id?: string | null;
  colaborador?: { id?: string; nome_completo?: string | null } | null;
}

export interface ClassificacaoConvenioResultado<T> {
  frotaPropria: T[];
  motoboys: T[];
  semVinculo: T[];
  totalFrotaPropria: number;
  totalMotoboys: number;
  totalSemVinculo: number;
  totalGeral: number;
}

export interface ConciliacaoFaturaResultado {
  saldoACargoEmbu: number;
  diferencaNaoIdentificada: number;
  temRiscoDivergencia: boolean;
  mensagemRisco: string | null;
}

export interface CalculoManutencaoFrotaParams {
  conveniosLancamentos: LancamentoConvenioItem[];
  faturasConvenios: Array<{
    valor_pago?: number | null;
    valor_total_fatura?: number | null;
    status?: string | null;
  }>;
  tipoVisao?: "realizado" | "previsto" | "projetado";
  empresaId?: number | null;
  shareEmpresa?: number;
  totalFaturamentoHolding?: number;
}

export function isDavidOuMotoEmbu(l: {
  moto_embu?: boolean | null;
  colaborador_id?: string | null;
  colaborador?: { nome_completo?: string | null } | null;
}): boolean {
  if (l.moto_embu) return true;
  if (l.colaborador_id === DAVID_CAITITE_ID) return true;
  if (l.colaborador?.nome_completo && l.colaborador.nome_completo.toUpperCase().includes("DAVID CAITIT")) {
    return true;
  }
  return false;
}

export function classificarLancamentosConvenio<T extends LancamentoConvenioItem>(
  lancamentos: T[]
): ClassificacaoConvenioResultado<T> {
  const frotaPropria: T[] = [];
  const motoboys: T[] = [];
  const semVinculo: T[] = [];

  for (const l of lancamentos) {
    if (isDavidOuMotoEmbu(l)) {
      frotaPropria.push(l);
    } else if (l.colaborador_id) {
      motoboys.push(l);
    } else {
      semVinculo.push(l);
    }
  }

  const totalFrotaPropria = parseFloat(
    frotaPropria.reduce((acc, l) => acc + Number(l.valor || 0), 0).toFixed(2)
  );
  const totalMotoboys = parseFloat(
    motoboys.reduce((acc, l) => acc + Number(l.valor || 0), 0).toFixed(2)
  );
  const totalSemVinculo = parseFloat(
    semVinculo.reduce((acc, l) => acc + Number(l.valor || 0), 0).toFixed(2)
  );
  const totalGeral = parseFloat(
    (totalFrotaPropria + totalMotoboys + totalSemVinculo).toFixed(2)
  );

  return {
    frotaPropria,
    motoboys,
    semVinculo,
    totalFrotaPropria,
    totalMotoboys,
    totalSemVinculo,
    totalGeral,
  };
}

export function calcularConciliacaoFatura(
  totalFatura: number,
  totalMotoboys: number,
  totalFrotaPropria: number,
  totalSemVinculo: number
): ConciliacaoFaturaResultado {
  const saldoACargoEmbu = parseFloat(
    Math.max(0, totalFatura - totalMotoboys).toFixed(2)
  );
  const diferencaNaoIdentificada = parseFloat(
    (saldoACargoEmbu - totalFrotaPropria).toFixed(2)
  );

  const temRiscoDivergencia = totalSemVinculo > 0 || Math.abs(diferencaNaoIdentificada) > 0.05;
  const mensagemRisco = temRiscoDivergencia
    ? `Atenção à conciliação: Foi identificada uma divergência de R$ ${Math.abs(diferencaNaoIdentificada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} entre o saldo a cargo da Embu e as despesas da frota própria, ou lançamentos sem vínculo. Verifique os lançamentos antes da quitação.`
    : null;

  return {
    saldoACargoEmbu,
    diferencaNaoIdentificada,
    temRiscoDivergencia,
    mensagemRisco,
  };
}

export function calcularManutencaoFrotaPropria({
  conveniosLancamentos,
  faturasConvenios,
  tipoVisao = "previsto",
  empresaId,
  shareEmpresa = 1,
  totalFaturamentoHolding = 0,
}: CalculoManutencaoFrotaParams): number {
  let manutencaoFrotaPropria = 0;
  let totalMotoboysLancamentos = 0;

  for (const c of conveniosLancamentos || []) {
    const isPropriaOuSemVinculo = isDavidOuMotoEmbu(c) || !c.colaborador_id;
    if (isPropriaOuSemVinculo) {
      manutencaoFrotaPropria += Number(c.valor || 0);
    } else {
      totalMotoboysLancamentos += Number(c.valor || 0);
    }
  }

  const totalFaturas = (faturasConvenios || []).reduce((acc, f) => {
    if (tipoVisao === "realizado" && f.status !== STATUS_FATURA_CONVENIO.PAGA && f.status !== STATUS_FATURA_CONVENIO.PAGO_PARCIAL) return acc;
    const v = f.valor_pago && (f.status === STATUS_FATURA_CONVENIO.PAGA || f.status === STATUS_FATURA_CONVENIO.PAGO_PARCIAL)
      ? Number(f.valor_pago)
      : Number(f.valor_total_fatura || 0);
    return acc + v;
  }, 0);

  if (totalFaturas > 0) {
    const saldoExcedenteFatura = Math.max(0, totalFaturas - totalMotoboysLancamentos);
    if (saldoExcedenteFatura > manutencaoFrotaPropria) {
      manutencaoFrotaPropria = saldoExcedenteFatura;
    }
  }

  if (empresaId && totalFaturamentoHolding > 0) {
    manutencaoFrotaPropria = manutencaoFrotaPropria * shareEmpresa;
  }

  return parseFloat(manutencaoFrotaPropria.toFixed(2));
}

export function gerarFaturaPrevisao({
  convenioId,
  mes,
  ano,
  diaVencimento,
  valorTotal,
  empresaId,
  contaBancariaId,
}: {
  convenioId: string;
  mes: number;
  ano: number;
  diaVencimento: number;
  valorTotal: number;
  empresaId?: number | null;
  contaBancariaId?: string | null;
}): FaturaFornecedorConvenio {
  const mesVenc = mes === 12 ? 1 : mes + 1;
  const anoVenc = mes === 12 ? ano + 1 : ano;
  const dataVencimento = `${anoVenc}-${String(mesVenc).padStart(2, "0")}-${String(diaVencimento).padStart(2, "0")}`;

  return {
    id: `prev-${convenioId}-${mes}-${ano}`,
    convenio_id: convenioId,
    mes_competencia: mes,
    ano_competencia: ano,
    data_vencimento: dataVencimento,
    valor_total_fatura: valorTotal,
    status: STATUS_FATURA_CONVENIO.PENDENTE,
    empresa_id: empresaId || null,
    conta_bancaria_id: contaBancariaId || null,
    valor_pago: null,
    data_pagamento: null,
    observacoes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    criado_por: null,
    is_previsao: true,
  };
}

export function extrairTopColaboradores(
  lancamentos: Array<{
    valor: number;
    colaborador_id: string | null;
    colaborador?: { id?: string; nome_completo?: string | null } | null;
    convenio_id: string;
    moto_embu?: boolean | null;
  }>,
  conveniosNomeMap: Map<string, string>,
  limite: number = 10
) {
  const colaboradoresMap = new Map<
    string,
    {
      colaborador_id: string;
      nome_completo: string;
      total_gasto: number;
      quantidade_lancamentos: number;
      convenios_utilizados: Set<string>;
    }
  >();

  for (const l of lancamentos) {
    if (l.colaborador_id && !isDavidOuMotoEmbu(l)) {
      const cId = l.colaborador_id;
      const nome = l.colaborador?.nome_completo || "Colaborador";
      const convNome = conveniosNomeMap.get(l.convenio_id) || "Convênio";

      if (!colaboradoresMap.has(cId)) {
        colaboradoresMap.set(cId, {
          colaborador_id: cId,
          nome_completo: nome,
          total_gasto: 0,
          quantidade_lancamentos: 0,
          convenios_utilizados: new Set<string>(),
        });
      }

      const cData = colaboradoresMap.get(cId)!;
      cData.total_gasto += Number(l.valor || 0);
      cData.quantidade_lancamentos += 1;
      cData.convenios_utilizados.add(convNome);
    }
  }

  return Array.from(colaboradoresMap.values())
    .map((c) => ({
      colaborador_id: c.colaborador_id,
      nome_completo: c.nome_completo,
      total_gasto: parseFloat(c.total_gasto.toFixed(2)),
      quantidade_lancamentos: c.quantidade_lancamentos,
      convenios_utilizados: Array.from(c.convenios_utilizados),
    }))
    .sort((a, b) => b.total_gasto - a.total_gasto)
    .slice(0, limite);
}

export const convenioRegrasService = {
  isDavidOuMotoEmbu,
  classificarLancamentosConvenio,
  calcularConciliacaoFatura,
  calcularManutencaoFrotaPropria,
  gerarFaturaPrevisao,
  extrairTopColaboradores,
};
