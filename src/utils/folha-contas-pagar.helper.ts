import { extractDateOnly } from "./utils.js";

export interface EmpresaJoin {
  id: number;
  nome_fantasia: string | null;
  razao_social: string;
}

export interface ContaBancariaJoin {
  id: string;
  banco_nome: string;
  agencia: string | null;
  conta: string | null;
  empresa_id: number;
  empresa?: EmpresaJoin | EmpresaJoin[] | null;
}

export interface TurnoComEmpresa {
  id: number;
  colaborador_id: string;
  empresa_id: number;
  valor_adiantamento: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  created_at: string | null;
  empresa?: EmpresaJoin | EmpresaJoin[] | null;
  usuario?: { id: string; nome_completo: string } | { id: string; nome_completo: string }[] | null;
  cliente?: Record<string, unknown> | null;
  unidade?: Record<string, unknown> | null;
  horarios?: Array<Record<string, unknown>>;
}

export interface FechamentoComConta {
  id: number;
  colaborador_id: string;
  mes: number;
  ano: number;
  saldo_final: number;
  pago: boolean | null;
  data_pagamento: string | null;
  conta_bancaria_id: string | null;
  lote_pagamento_id: string | null;
  conta_bancaria?: ContaBancariaJoin | ContaBancariaJoin[] | null;
}

export interface ConfirmacaoComConta {
  id: number;
  colaborador_id: string;
  mes: number;
  ano: number;
  valor: number | null;
  data_confirmacao: string | null;
  data_pagamento: string | null;
  conta_bancaria_id: string | null;
  lote_pagamento_id: string | null;
  conta_bancaria?: ContaBancariaJoin | ContaBancariaJoin[] | null;
  usuario?: { id: string; nome_completo: string } | { id: string; nome_completo: string }[] | null;
}

export function unwrapSingle<T>(val: T | T[] | null | undefined): T | null {
  if (!val) return null;
  return Array.isArray(val) ? val[0] ?? null : val;
}

export function resolverEmpresaDosTurnos(turnosVigentes: TurnoComEmpresa[]): {
  empresaId: number | null;
  empresaNome?: string;
} {
  const empresasMap = new Map<number, string>();
  for (const t of turnosVigentes) {
    if (t.empresa_id) {
      const emp = unwrapSingle(t.empresa);
      const nome = emp?.nome_fantasia || emp?.razao_social || "";
      empresasMap.set(t.empresa_id, nome);
    }
  }
  if (empresasMap.size === 1) {
    const [id, nome] = Array.from(empresasMap.entries())[0];
    return { empresaId: id, empresaNome: nome || undefined };
  }
  return { empresaId: null, empresaNome: undefined };
}

export function filtrarTurnosVigentesNoMes(
  turnos: TurnoComEmpresa[],
  dataInicioMesStr: string,
  dataFimMesStr: string
): TurnoComEmpresa[] {
  return turnos.filter((l) => {
    const dIni = extractDateOnly(l.data_inicio) || extractDateOnly(l.created_at);
    const dFim = extractDateOnly(l.data_fim);
    return (!dIni || dIni <= dataFimMesStr) && (!dFim || dFim >= dataInicioMesStr);
  });
}

export function parseItemColaboradorId(itemId: string): {
  subtipo: string;
  colaboradorId: string;
  mesComp: number;
  anoComp: number;
} | null {
  const parts = itemId.split("_");
  if (parts.length !== 5 || parts[0] !== "colab") {
    return null;
  }
  const subtipo = parts[1];
  const colaboradorId = parts[2];
  const mesComp = Number(parts[3]);
  const anoComp = Number(parts[4]);
  if (!colaboradorId || !mesComp || !anoComp) {
    return null;
  }
  return { subtipo, colaboradorId, mesComp, anoComp };
}
