import { faturamentoService } from "../services/faturamento.service.js";
import { STATUS_FATURA } from "../constants/financeiro.enum.js";

export interface RateioCorporativoResultado {
  shareEmpresa: number;
  faturamentoBrutoEmpresa: number;
  totalFaturamentoHolding: number;
}

export async function calcularShareHolding(
  empresaId?: number | null,
  mes?: number,
  ano?: number,
  tipoVisao: "realizado" | "previsto" | "projetado" = "previsto"
): Promise<RateioCorporativoResultado> {
  if (!mes || !ano) {
    return {
      shareEmpresa: 1,
      faturamentoBrutoEmpresa: 0,
      totalFaturamentoHolding: 0,
    };
  }

  const faturasList = await faturamentoService.listFaturas({ mes, ano });
  const faturasValidas = (faturasList || []).filter((f) => {
    if (f.status === STATUS_FATURA.CANCELADA) return false;
    if (tipoVisao === "realizado" && f.is_previsao) return false;
    return true;
  });

  const getValor = (f: { valor_pago?: number | null; status?: string | null; valor_faturado?: number | null }) => {
    if (tipoVisao === "realizado") {
      return Number(f.valor_pago || 0);
    }
    return Number(f.valor_faturado || 0);
  };

  const totalFaturamentoHolding = faturasValidas.reduce(
    (acc, f) => acc + getValor(f),
    0
  );

  if (!empresaId) {
    return {
      shareEmpresa: 1,
      faturamentoBrutoEmpresa: totalFaturamentoHolding,
      totalFaturamentoHolding,
    };
  }

  const faturasEmpresa = faturasValidas.filter(
    (f) => Number(f.empresa_id) === Number(empresaId)
  );

  const faturamentoBrutoEmpresa = faturasEmpresa.reduce(
    (acc, f) => acc + getValor(f),
    0
  );

  const shareEmpresa =
    totalFaturamentoHolding > 0
      ? faturamentoBrutoEmpresa / totalFaturamentoHolding
      : 1;

  return {
    shareEmpresa,
    faturamentoBrutoEmpresa,
    totalFaturamentoHolding,
  };
}
