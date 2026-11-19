import { dreRepository } from "../repositories/dre.repository.js";
import { convenioAuditoriaRepository } from "../repositories/convenio-auditoria.repository.js";
import { financeiroService } from "./financeiro.service.js";
import { faturamentoService } from "./faturamento.service.js";
import { despesaService } from "./despesa.service.js";
import { calcularShareHolding } from "../utils/rateio-corporativo.helper.js";
import { convenioRegrasService } from "./convenio-regras.service.js";
import { categoriaFinanceiraRepository } from "../repositories/categoria-financeira.repository.js";
import {
  CATEGORIA_DESPESA,
  CATEGORIA_MOVIMENTACAO_AVULSA,
  GRUPO_DRE_CATEGORIA,
  STATUS_DESPESA,
  STATUS_FATURA,
  TIPO_MOVIMENTACAO_AVULSA,
} from "../constants/financeiro.enum.js";

export interface DreItem {
  descricao: string;
  valor: number;
  percentual?: number;
}

export interface DreGrupoDespesas {
  total: number;
  diretas: number;
  rateio_holding: number;
  itens: DreItem[];
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
  despesas_fixas: DreGrupoDespesas;
  despesas_variaveis: DreGrupoDespesas;
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

interface AcumuladorDespesaGrupo {
  diretas: number;
  holding: number;
  itens: DreItem[];
}

function acumularDespesaNoGrupo(
  grupo: AcumuladorDespesaGrupo,
  descricao: string,
  valor: number,
  empresaId: number | undefined,
  isDestaEmpresa: boolean,
  isHoldingDespesa: boolean,
  isGeralHolding: boolean,
  shareEmpresa: number
) {
  if (empresaId) {
    if (isDestaEmpresa && !isHoldingDespesa) {
      grupo.diretas += valor;
      grupo.itens.push({ descricao, valor });
    } else if (isGeralHolding) {
      const valorRateado = valor * shareEmpresa;
      grupo.holding += valorRateado;
      grupo.itens.push({ descricao: `${descricao} (Rateio Holding)`, valor: valorRateado });
    }
  } else {
    grupo.diretas += valor;
    grupo.itens.push({ descricao, valor });
  }
}

export const dreService = {
  async getDRE(
    mes: number,
    ano: number,
    empresaId?: number,
    tipoVisao: "realizado" | "projetado" = "realizado"
  ): Promise<DreConsolidado> {
    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFimStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

    const {
      shareEmpresa,
      faturamentoBrutoEmpresa: faturamentoBruto,
      totalFaturamentoHolding,
    } = await calcularShareHolding(empresaId, mes, ano, tipoVisao);

    let empresaNome = "Consolidado (Holding)";
    if (empresaId) {
      const nomeFantasia = await dreRepository.getEmpresaNomeFantasia(empresaId);
      if (nomeFantasia) empresaNome = nomeFantasia;
    }

    const dashboardFolha = await financeiroService.getDashboardLote(mes, ano);
    let custoPessoalFolha = tipoVisao === "realizado"
      ? Number(dashboardFolha.valorPago || 0) + Number(dashboardFolha.totalAdiantamentoPago || 0)
      : Number(dashboardFolha.totalFolha || 0) + Number(dashboardFolha.totalAdiantamentoPago || 0);

    if (empresaId && totalFaturamentoHolding > 0) {
      custoPessoalFolha = custoPessoalFolha * shareEmpresa;
    }

    const [conveniosLancamentos, faturasConvenios] = await Promise.all([
      convenioAuditoriaRepository.listLancamentosGeraisPeriodo(dataInicioStr, dataFimStr),
      convenioAuditoriaRepository.listFaturasPorCompetencia(mes, ano),
    ]);

    const manutencaoFrotaPropria = convenioRegrasService.calcularManutencaoFrotaPropria({
      conveniosLancamentos,
      faturasConvenios,
      tipoVisao,
      empresaId,
      shareEmpresa,
      totalFaturamentoHolding,
    });

    const [movAvulsas, categoriasFinanceiras] = await Promise.all([
      dreRepository.listMovimentacoesAvulsasPeriodo(mes, ano),
      categoriaFinanceiraRepository.findAll(),
    ]);

    const categoriasMap = new Map(
      categoriasFinanceiras.map((c) => [c.codigo, c])
    );

    const movAvulsasFiltradas = empresaId
      ? (movAvulsas || []).filter(m => Number(m.empresa_id) === Number(empresaId))
      : (movAvulsas || []);

    let outrasReceitasOperacionais = 0;
    let despesasAvulsas = 0;
    const itensDespesasAvulsas: DreItem[] = [];
    let despesasVariaveisAvulsas = 0;
    const itensDespesasVariaveisAvulsas: DreItem[] = [];

    let tributoDasAvulso = 0;
    let prolaboreAvulso = 0;
    let parcelamentosFiscaisAvulso = 0;
    let investimentosFinanciamentosAvulso = 0;
    let despesasFinanceirasAvulso = 0;

    movAvulsasFiltradas.forEach(m => {
      if (
        m.categoria === CATEGORIA_MOVIMENTACAO_AVULSA.TRANSFERENCIA_ENTRE_CONTAS ||
        Boolean(m.transferencia_par_id)
      ) {
        return;
      }
      const catInfo = categoriasMap.get(m.categoria);
      if (catInfo && (!catInfo.afeta_dre || catInfo.grupo_dre === GRUPO_DRE_CATEGORIA.NAO_AFETA_DRE)) {
        return;
      }
      if (!catInfo && m.categoria === CATEGORIA_MOVIMENTACAO_AVULSA.DOACAO_APORTE) {
        return;
      }

      const v = Number(m.valor || 0);
      if (m.tipo_movimentacao === TIPO_MOVIMENTACAO_AVULSA.ENTRADA) {
        outrasReceitasOperacionais += v;
      } else {
        const grupoDreSaida = catInfo?.grupo_dre;
        if (grupoDreSaida === GRUPO_DRE_CATEGORIA.DESPESA_VARIAVEL) {
          despesasVariaveisAvulsas += v;
          itensDespesasVariaveisAvulsas.push({ descricao: `${m.descricao} (Avulso)`, valor: v });
        } else if (grupoDreSaida === GRUPO_DRE_CATEGORIA.TRIBUTO_DAS) {
          tributoDasAvulso += v;
        } else if (grupoDreSaida === GRUPO_DRE_CATEGORIA.PROLABORE) {
          prolaboreAvulso += v;
        } else if (grupoDreSaida === GRUPO_DRE_CATEGORIA.PARCELAMENTO_FISCAL) {
          parcelamentosFiscaisAvulso += v;
        } else if (grupoDreSaida === GRUPO_DRE_CATEGORIA.INVESTIMENTO_FINANCIAMENTO) {
          investimentosFinanciamentosAvulso += v;
        } else if (
          grupoDreSaida === GRUPO_DRE_CATEGORIA.DESPESA_FINANCEIRA ||
          (!catInfo && m.categoria === CATEGORIA_MOVIMENTACAO_AVULSA.TARIFA_BANCARIA)
        ) {
          despesasFinanceirasAvulso += v;
        } else {
          despesasAvulsas += v;
          itensDespesasAvulsas.push({ descricao: `${m.descricao} (Avulso)`, valor: v });
        }
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
      if (tipoVisao === "realizado" && d.status !== STATUS_DESPESA.PAGO && (!d.valor_pago || Number(d.valor_pago) <= 0)) return false;
      return true;
    });

    const grupoFixas: AcumuladorDespesaGrupo = {
      diretas: despesasAvulsas,
      holding: 0,
      itens: [...itensDespesasAvulsas],
    };
    const grupoVariaveis: AcumuladorDespesaGrupo = {
      diretas: despesasVariaveisAvulsas,
      holding: 0,
      itens: [...itensDespesasVariaveisAvulsas],
    };

    let tributoDasValor = tributoDasAvulso;
    let tributoDasProvisionado = tributoDasAvulso <= 0;
    let prolabore = prolaboreAvulso;
    let parcelamentosFiscais = parcelamentosFiscaisAvulso;
    let investimentosFinanciamentos = investimentosFinanciamentosAvulso;
    let despesasFinanceiras = despesasFinanceirasAvulso;

    (despesas || []).forEach(d => {
      const catInfo = categoriasMap.get(d.categoria);
      if (catInfo && (!catInfo.afeta_dre || catInfo.grupo_dre === GRUPO_DRE_CATEGORIA.NAO_AFETA_DRE)) {
        return;
      }

      const grupoDre = catInfo?.grupo_dre || d.categoria;
      const valor = tipoVisao === "realizado"
        ? Number(d.valor_pago || (d.status === STATUS_DESPESA.PAGO ? d.valor_previsto : 0) || 0)
        : Number(d.valor_previsto || 0);
      const isDestaEmpresa = empresaId ? Number(d.empresa_id) === Number(empresaId) : true;
      const isHoldingDespesa = Boolean(d.is_holding);
      const isGeralHolding = !d.empresa_id || isHoldingDespesa;

      const isDespesaOperacionalFixa =
        grupoDre === GRUPO_DRE_CATEGORIA.DESPESA_FIXA ||
        d.categoria === CATEGORIA_DESPESA.DESPESA_FIXA ||
        d.categoria === CATEGORIA_DESPESA.DESPESA_ADMINISTRATIVA ||
        d.categoria === CATEGORIA_DESPESA.CARTAO_CREDITO ||
        d.categoria === CATEGORIA_DESPESA.DESPESA_FROTA_DOCUMENTO;

      if (grupoDre === GRUPO_DRE_CATEGORIA.DESPESA_VARIAVEL) {
        acumularDespesaNoGrupo(
          grupoVariaveis,
          d.descricao,
          valor,
          empresaId,
          isDestaEmpresa,
          isHoldingDespesa,
          isGeralHolding,
          shareEmpresa
        );
      } else if (isDespesaOperacionalFixa) {
        acumularDespesaNoGrupo(
          grupoFixas,
          d.descricao,
          valor,
          empresaId,
          isDestaEmpresa,
          isHoldingDespesa,
          isGeralHolding,
          shareEmpresa
        );
      } else if (grupoDre === GRUPO_DRE_CATEGORIA.TRIBUTO_DAS || d.categoria === CATEGORIA_DESPESA.TRIBUTO_DAS) {
        if (empresaId) {
          if (isDestaEmpresa) {
            tributoDasValor += valor;
            tributoDasProvisionado = false;
          }
        } else {
          tributoDasValor += valor;
          tributoDasProvisionado = false;
        }
      } else if (grupoDre === GRUPO_DRE_CATEGORIA.PROLABORE || d.categoria === CATEGORIA_DESPESA.PROLABORE) {
        if (empresaId) {
          if (isDestaEmpresa) prolabore += valor;
          else if (isGeralHolding) prolabore += valor * shareEmpresa;
        } else {
          prolabore += valor;
        }
      } else if (grupoDre === GRUPO_DRE_CATEGORIA.PARCELAMENTO_FISCAL || d.categoria === CATEGORIA_DESPESA.PARCELAMENTO_FISCAL) {
        if (empresaId) {
          if (isDestaEmpresa) parcelamentosFiscais += valor;
          else if (isGeralHolding) parcelamentosFiscais += valor * shareEmpresa;
        } else {
          parcelamentosFiscais += valor;
        }
      } else if (
        grupoDre === GRUPO_DRE_CATEGORIA.INVESTIMENTO_FINANCIAMENTO ||
        d.categoria === CATEGORIA_DESPESA.INVESTIMENTO_FINANCIAMENTO ||
        d.categoria === CATEGORIA_DESPESA.INVESTIMENTO_PATRIMONIAL
      ) {
        if (empresaId) {
          if (isDestaEmpresa) investimentosFinanciamentos += valor;
          else if (isGeralHolding) investimentosFinanciamentos += valor * shareEmpresa;
        } else {
          investimentosFinanciamentos += valor;
        }
      } else if (grupoDre === GRUPO_DRE_CATEGORIA.DESPESA_FINANCEIRA || d.categoria === CATEGORIA_DESPESA.DESPESA_FINANCEIRA) {
        if (empresaId) {
          if (isDestaEmpresa) despesasFinanceiras += valor;
          else if (isGeralHolding) despesasFinanceiras += valor * shareEmpresa;
        } else {
          despesasFinanceiras += valor;
        }
      } else {
        acumularDespesaNoGrupo(
          grupoFixas,
          d.descricao,
          valor,
          empresaId,
          isDestaEmpresa,
          isHoldingDespesa,
          isGeralHolding,
          shareEmpresa
        );
      }
    });

    if (tributoDasProvisionado) {
      tributoDasValor = faturamentoBruto * 0.065;
    }

    const totalDespesasFixas = grupoFixas.diretas + grupoFixas.holding;
    const totalDespesasVariaveis = grupoVariaveis.diretas + grupoVariaveis.holding;
    const lucroOperacional = lucroBruto - totalDespesasFixas - totalDespesasVariaveis - tributoDasValor;
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
        diretas: parseFloat(grupoFixas.diretas.toFixed(2)),
        rateio_holding: parseFloat(grupoFixas.holding.toFixed(2)),
        itens: grupoFixas.itens,
      },
      despesas_variaveis: {
        total: parseFloat(totalDespesasVariaveis.toFixed(2)),
        diretas: parseFloat(grupoVariaveis.diretas.toFixed(2)),
        rateio_holding: parseFloat(grupoVariaveis.holding.toFixed(2)),
        itens: grupoVariaveis.itens,
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
