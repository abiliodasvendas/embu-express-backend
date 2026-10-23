import { dreRepository } from "../repositories/dre.repository.js";
import { convenioAuditoriaRepository } from "../repositories/convenio-auditoria.repository.js";
import { financeiroService } from "./financeiro.service.js";
import { faturamentoService } from "./faturamento.service.js";
import { despesaService } from "./despesa.service.js";
import {
  CATEGORIA_DESPESA,
  STATUS_DESPESA,
  STATUS_FATURA,
} from "../constants/financeiro.enum.js";

export interface DreItem {
  descricao: string;
  valor: number;
  percentual?: number;
}

export interface DreConsolidado {
  periodo: { mes: number; ano: number };
  tipo_visao?: "realizado" | "projetado";
  empresa_id?: number | null;
  empresa_nome?: string;
  faturamento_bruto: number;
  outras_receitas_operacionais: number;
  receita_operacional_total: number;
  custos_diretos: {
    total: number;
    custo_pessoal_folha: number;
    manutencao_frota_propria: number;
  };
  lucro_bruto: number;
  margem_bruta_percentual: number;
  despesas_fixas: {
    total: number;
    diretas: number;
    rateio_holding: number;
    itens: DreItem[];
  };
  tributos_correntes_das: {
    total: number;
    is_provisionado: boolean;
  };
  lucro_operacional: number;
  prolabore: number;
  parcelamentos_fiscais: number;
  investimentos_financiamentos: number;
  despesas_financeiras: number;
  lucro_liquido: number;
  margem_liquida_percentual: number;
}

export const dreService = {
  async getDRE(
    mes: number,
    ano: number,
    empresaId?: number,
    tipoVisao: "realizado" | "projetado" = "projetado"
  ): Promise<DreConsolidado> {
    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFimStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

    const faturasList = await faturamentoService.listFaturas({ mes, ano });
    const todasFaturasHolding = faturasList.filter(f => {
      if (f.status === STATUS_FATURA.CANCELADA) return false;
      if (tipoVisao === "realizado" && f.is_previsao) return false;
      return true;
    });

    const totalFaturamentoHolding = (todasFaturasHolding || []).reduce((acc, f) => {
      const v = tipoVisao === "realizado" && f.valor_pago && f.status === STATUS_FATURA.LIQUIDADA
        ? Number(f.valor_pago)
        : Number(f.valor_faturado || 0);
      return acc + v;
    }, 0);

    const faturasEmpresa = empresaId
      ? (todasFaturasHolding || []).filter(f => Number(f.empresa_id) === Number(empresaId))
      : (todasFaturasHolding || []);

    const faturamentoBruto = faturasEmpresa.reduce((acc, f) => {
      const v = tipoVisao === "realizado" && f.valor_pago && f.status === STATUS_FATURA.LIQUIDADA
        ? Number(f.valor_pago)
        : Number(f.valor_faturado || 0);
      return acc + v;
    }, 0);

    const shareEmpresa = totalFaturamentoHolding > 0 && empresaId
      ? faturamentoBruto / totalFaturamentoHolding
      : 1;

    let empresaNome = "Consolidado (Holding)";
    if (empresaId) {
      const nomeFantasia = await dreRepository.getEmpresaNomeFantasia(empresaId);
      if (nomeFantasia) empresaNome = nomeFantasia;
    }

    const dashboardFolha = await financeiroService.getDashboardLote(mes, ano);
    let custoPessoalFolha = tipoVisao === "realizado"
      ? Number(dashboardFolha.valorPago || 0) + Number(dashboardFolha.totalAdiantamentoPago || 0)
      : Number(dashboardFolha.totalFolha || 0);

    if (empresaId && totalFaturamentoHolding > 0) {
      custoPessoalFolha = custoPessoalFolha * shareEmpresa;
    }

    const DAVID_CAITITE_ID = "e7c2c19c-3b36-402a-9e73-9a3c3c3c3c3c";
    const [conveniosLancamentos, faturasConvenios] = await Promise.all([
      convenioAuditoriaRepository.listLancamentosGeraisPeriodo(dataInicioStr, dataFimStr),
      convenioAuditoriaRepository.listFaturasPorCompetencia(mes, ano),
    ]);

    let manutencaoFrotaPropria = 0;
    (conveniosLancamentos || []).forEach(c => {
      const isDavidOuMotoEmbu = c.moto_embu || c.colaborador_id === DAVID_CAITITE_ID;
      if (isDavidOuMotoEmbu) {
        manutencaoFrotaPropria += Number(c.valor || 0);
      }
    });

    const totalMotoboysLancamentos = (conveniosLancamentos || [])
      .filter(c => !c.moto_embu && c.colaborador_id !== DAVID_CAITITE_ID && c.colaborador_id)
      .reduce((acc, c) => acc + Number(c.valor || 0), 0);

    const totalFaturas = (faturasConvenios || []).reduce((acc, f) => {
      if (tipoVisao === "realizado" && f.status !== "PAGA") return acc;
      const v = f.valor_pago && f.status === "PAGA" ? Number(f.valor_pago) : Number(f.valor_total_fatura || 0);
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

    const movAvulsas = await dreRepository.listMovimentacoesAvulsasPeriodo(mes, ano);

    const movAvulsasFiltradas = empresaId
      ? (movAvulsas || []).filter(m => Number(m.empresa_id) === Number(empresaId))
      : (movAvulsas || []);

    let outrasReceitasOperacionais = 0;
    let despesasAvulsas = 0;
    const itensDespesasAvulsas: DreItem[] = [];

    movAvulsasFiltradas.forEach(m => {
      const v = Number(m.valor || 0);
      if (m.tipo_movimentacao === "ENTRADA") {
        outrasReceitasOperacionais += v;
      } else {
        despesasAvulsas += v;
        itensDespesasAvulsas.push({ descricao: `${m.descricao} (Avulso)`, valor: v });
      }
    });

    const receitaOperacionalTotal = faturamentoBruto + outrasReceitasOperacionais;
    const totalCustosDiretos = custoPessoalFolha + manutencaoFrotaPropria;
    const lucroBruto = receitaOperacionalTotal - totalCustosDiretos;
    const margemBrutaPercentual = receitaOperacionalTotal > 0
      ? (lucroBruto / receitaOperacionalTotal) * 100
      : 0;

    const despesasList = await despesaService.list({ mes, ano });
    const despesas = despesasList.filter(d => {
      if (d.status === STATUS_DESPESA.CANCELADO) return false;
      if (tipoVisao === "realizado" && d.status !== STATUS_DESPESA.PAGO) return false;
      return true;
    });

    let despesasFixasDiretas = despesasAvulsas;
    let despesasFixasHolding = 0;
    const itensDespesaFixa: DreItem[] = [...itensDespesasAvulsas];

    let tributoDasValor = 0;
    let tributoDasProvisionado = true;
    let prolabore = 0;
    let parcelamentosFiscais = 0;
    let investimentosFinanciamentos = 0;
    let despesasFinanceiras = 0;

    (despesas || []).forEach(d => {
      const valor = Number(d.valor_pago && d.status === STATUS_DESPESA.PAGO ? d.valor_pago : d.valor_previsto);
      const isDestaEmpresa = empresaId ? Number(d.empresa_id) === Number(empresaId) : true;
      const isGeralHolding = !d.empresa_id || d.is_holding;

      const isDespesaOperacionalFixa =
        d.categoria === CATEGORIA_DESPESA.DESPESA_FIXA ||
        d.categoria === CATEGORIA_DESPESA.DESPESA_ADMINISTRATIVA ||
        d.categoria === CATEGORIA_DESPESA.CARTAO_CREDITO ||
        d.categoria === CATEGORIA_DESPESA.DESPESA_FROTA_DOCUMENTO;

      if (isDespesaOperacionalFixa) {
        if (empresaId) {
          if (isDestaEmpresa && !d.is_holding) {
            despesasFixasDiretas += valor;
            itensDespesaFixa.push({ descricao: d.descricao, valor });
          } else if (isGeralHolding) {
            despesasFixasHolding += valor * shareEmpresa;
            itensDespesaFixa.push({ descricao: `${d.descricao} (Rateio Holding)`, valor: valor * shareEmpresa });
          }
        } else {
          despesasFixasDiretas += valor;
          itensDespesaFixa.push({ descricao: d.descricao, valor });
        }
      } else if (d.categoria === CATEGORIA_DESPESA.TRIBUTO_DAS) {
        if (empresaId) {
          if (isDestaEmpresa) {
            tributoDasValor += valor;
            tributoDasProvisionado = false;
          }
        } else {
          tributoDasValor += valor;
          tributoDasProvisionado = false;
        }
      } else if (d.categoria === CATEGORIA_DESPESA.PROLABORE) {
        if (empresaId) {
          if (isDestaEmpresa) prolabore += valor;
          else if (isGeralHolding) prolabore += valor * shareEmpresa;
        } else {
          prolabore += valor;
        }
      } else if (d.categoria === CATEGORIA_DESPESA.PARCELAMENTO_FISCAL) {
        if (empresaId) {
          if (isDestaEmpresa) parcelamentosFiscais += valor;
          else if (isGeralHolding) parcelamentosFiscais += valor * shareEmpresa;
        } else {
          parcelamentosFiscais += valor;
        }
      } else if (
        d.categoria === CATEGORIA_DESPESA.INVESTIMENTO_FINANCIAMENTO ||
        d.categoria === CATEGORIA_DESPESA.INVESTIMENTO_PATRIMONIAL
      ) {
        if (empresaId) {
          if (isDestaEmpresa) investimentosFinanciamentos += valor;
          else if (isGeralHolding) investimentosFinanciamentos += valor * shareEmpresa;
        } else {
          investimentosFinanciamentos += valor;
        }
      } else if (d.categoria === CATEGORIA_DESPESA.DESPESA_FINANCEIRA) {
        if (empresaId) {
          if (isDestaEmpresa) despesasFinanceiras += valor;
          else if (isGeralHolding) despesasFinanceiras += valor * shareEmpresa;
        } else {
          despesasFinanceiras += valor;
        }
      }
    });

    if (tributoDasProvisionado) {
      tributoDasValor = faturamentoBruto * 0.065;
    }

    const totalDespesasFixas = despesasFixasDiretas + despesasFixasHolding;
    const lucroOperacional = lucroBruto - totalDespesasFixas - tributoDasValor;
    const lucroLiquido = lucroOperacional - prolabore - parcelamentosFiscais - investimentosFinanciamentos - despesasFinanceiras;
    const margemLiquidaPercentual = receitaOperacionalTotal > 0
      ? (lucroLiquido / receitaOperacionalTotal) * 100
      : 0;

    return {
      periodo: { mes, ano },
      tipo_visao: tipoVisao,
      empresa_id: empresaId || null,
      empresa_nome: empresaNome,
      faturamento_bruto: parseFloat(faturamentoBruto.toFixed(2)),
      outras_receitas_operacionais: parseFloat(outrasReceitasOperacionais.toFixed(2)),
      receita_operacional_total: parseFloat(receitaOperacionalTotal.toFixed(2)),
      custos_diretos: {
        total: parseFloat(totalCustosDiretos.toFixed(2)),
        custo_pessoal_folha: parseFloat(custoPessoalFolha.toFixed(2)),
        manutencao_frota_propria: parseFloat(manutencaoFrotaPropria.toFixed(2)),
      },
      lucro_bruto: parseFloat(lucroBruto.toFixed(2)),
      margem_bruta_percentual: parseFloat(margemBrutaPercentual.toFixed(2)),
      despesas_fixas: {
        total: parseFloat(totalDespesasFixas.toFixed(2)),
        diretas: parseFloat(despesasFixasDiretas.toFixed(2)),
        rateio_holding: parseFloat(despesasFixasHolding.toFixed(2)),
        itens: itensDespesaFixa,
      },
      tributos_correntes_das: {
        total: parseFloat(tributoDasValor.toFixed(2)),
        is_provisionado: tributoDasProvisionado,
      },
      lucro_operacional: parseFloat(lucroOperacional.toFixed(2)),
      prolabore: parseFloat(prolabore.toFixed(2)),
      parcelamentos_fiscais: parseFloat(parcelamentosFiscais.toFixed(2)),
      investimentos_financiamentos: parseFloat(investimentosFinanciamentos.toFixed(2)),
      despesas_financeiras: parseFloat(despesasFinanceiras.toFixed(2)),
      lucro_liquido: parseFloat(lucroLiquido.toFixed(2)),
      margem_liquida_percentual: parseFloat(margemLiquidaPercentual.toFixed(2)),
    };
  },
};
