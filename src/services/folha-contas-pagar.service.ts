import { configuracaoService } from "./configuracao.service.js";
import { financeiroService } from "./financeiro.service.js";
import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";
import { folhaContasPagarRepository } from "../repositories/folha-contas-pagar.repository.js";
import { obterColaboradoresElegiveisMes } from "../utils/financeiro-fechamento.helper.js";
import { extractDateOnly } from "../utils/utils.js";
import {
  filtrarTurnosVigentesNoMes,
  parseItemColaboradorId,
  resolverEmpresaDosTurnos,
  unwrapSingle,
} from "../utils/folha-contas-pagar.helper.js";
import {
  CATEGORIA_COLABORADOR_CONTA_PAGAR,
  STATUS_DESPESA,
  SUBTIPO_COLABORADOR_CONTA_PAGAR,
  TIPO_CONTA_PAGAR,
} from "../constants/financeiro.enum.js";
import { ContaPagarItem } from "./contas-pagar.service.js";
import { AppError } from "../errors/AppError.js";

export const folhaContasPagarService = {
  async listarItensColaboradoresParaContasPagar(
    mesCaixa: number,
    anoCaixa: number,
    empresaIdFiltro?: number
  ): Promise<ContaPagarItem[]> {
    const ultimoDiaMesCaixa = new Date(Date.UTC(anoCaixa, mesCaixa, 0)).getUTCDate();

    const [configSalarios, configVales] = await Promise.all([
      configuracaoService.getConfiguracao("dia_desembolso_salarios"),
      configuracaoService.getConfiguracao("dia_desembolso_vales"),
    ]);

    const diaSalarios = Math.min(
      Math.max(parseInt(configSalarios?.valor || "7", 10) || 7, 1),
      ultimoDiaMesCaixa
    );
    const diaVales = Math.min(
      Math.max(parseInt(configVales?.valor || "20", 10) || 20, 1),
      ultimoDiaMesCaixa
    );

    const vencimentoSalarios = `${anoCaixa}-${String(mesCaixa).padStart(2, "0")}-${String(diaSalarios).padStart(2, "0")}`;
    const vencimentoVales = `${anoCaixa}-${String(mesCaixa).padStart(2, "0")}-${String(diaVales).padStart(2, "0")}`;

    let mesCompSalario = mesCaixa - 1;
    let anoCompSalario = anoCaixa;
    if (mesCompSalario === 0) {
      mesCompSalario = 12;
      anoCompSalario = anoCaixa - 1;
    }

    const [itensSalarios, itensVales] = await Promise.all([
      this._listarSalariosCompetencia(
        mesCompSalario,
        anoCompSalario,
        vencimentoSalarios,
        empresaIdFiltro
      ),
      this._listarValesCompetencia(
        mesCaixa,
        anoCaixa,
        vencimentoVales,
        empresaIdFiltro
      ),
    ]);

    return [...itensSalarios, ...itensVales];
  },

  async _listarSalariosCompetencia(
    mesComp: number,
    anoComp: number,
    dataVencimentoCaixa: string,
    empresaIdFiltro?: number
  ): Promise<ContaPagarItem[]> {
    const ultimoDiaMes = new Date(Date.UTC(anoComp, mesComp, 0)).getUTCDate();
    const dataInicioMesStr = `${anoComp}-${String(mesComp).padStart(2, "0")}-01`;
    const dataFimMesStr = `${anoComp}-${String(mesComp).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    const colaboradoresElegiveis = await obterColaboradoresElegiveisMes({
      mes: mesComp,
      ano: anoComp,
      dataInicioMesStr,
      dataFimMesStr,
    });

    if (!colaboradoresElegiveis || colaboradoresElegiveis.length === 0) {
      return [];
    }

    const colabIds = colaboradoresElegiveis.map((c) => c.id);

    const { fechamentosMap, feriadosMes } =
      await folhaContasPagarRepository.listFechamentosPagosEFeriados(
        mesComp,
        anoComp,
        dataInicioMesStr,
        dataFimMesStr
      );

    const {
      linksPorUsuario,
      ocorrenciasPorUsuario,
      fechamentosAntMap,
      pontosPorUsuario,
      confirmacoesMap,
      conveniosPorUsuario,
    } = await folhaContasPagarRepository.carregarDadosSalariosEmLote({
      colabIds,
      mesComp,
      anoComp,
      dataInicioMesStr,
      dataFimMesStr,
      fechamentosMap,
    });

    const itens: ContaPagarItem[] = [];
    const refStr = `${String(mesComp).padStart(2, "0")}/${anoComp}`;

    for (const colab of colaboradoresElegiveis) {
      const linksColab = linksPorUsuario.get(colab.id) || [];
      const turnosVigentes = filtrarTurnosVigentesNoMes(
        linksColab,
        dataInicioMesStr,
        dataFimMesStr
      );

      const { empresaId: empresaPrevistaId, empresaNome: empresaPrevistaNome } =
        resolverEmpresaDosTurnos(turnosVigentes);

      const fechamento = fechamentosMap.get(colab.id);

      let saldoFinal = 0;
      let isPago = false;
      let contaBancariaId: string | null = null;
      let contaBancariaNome: string | undefined = undefined;
      let empresaEfetivaId = empresaPrevistaId;
      let empresaEfetivaNome = empresaPrevistaNome;
      let dataPagamento: string | null = null;
      let lotePagamentoId: string | null = null;

      if (fechamento) {
        saldoFinal = parseFloat(Number(fechamento.saldo_final || 0).toFixed(2));
        isPago = true;
        contaBancariaId = fechamento.conta_bancaria_id || null;
        const contaObj = unwrapSingle(fechamento.conta_bancaria);
        contaBancariaNome = contaObj?.banco_nome;
        if (contaObj?.empresa_id) {
          empresaEfetivaId = contaObj.empresa_id;
          const empConta = unwrapSingle(contaObj.empresa);
          empresaEfetivaNome =
            empConta?.nome_fantasia || empConta?.razao_social || empresaPrevistaNome;
        }
        dataPagamento = extractDateOnly(fechamento.data_pagamento);
        lotePagamentoId = fechamento.lote_pagamento_id || null;
      } else {
        const extrato = financeiroService._calcularMatematicaExtrato({
          usuarioId: colab.id,
          mes: mesComp,
          ano: anoComp,
          usuario: colab,
          links: linksColab,
          ocorrencias: ocorrenciasPorUsuario.get(colab.id) || [],
          fechamentoAnterior: fechamentosAntMap.get(colab.id) || null,
          pontos: pontosPorUsuario.get(colab.id) || [],
          feriadosMes,
          confirmacaoAdiantamento: confirmacoesMap.get(colab.id) || null,
          lancamentosConvenios: conveniosPorUsuario.get(colab.id) || [],
        });
        saldoFinal = parseFloat(Number(extrato.totais.saldo_final || 0).toFixed(2));
      }

      if (saldoFinal <= 0) continue;
      if (empresaIdFiltro && empresaEfetivaId !== empresaIdFiltro) continue;

      itens.push({
        id: `colab_salario_${colab.id}_${mesComp}_${anoComp}`,
        tipo: TIPO_CONTA_PAGAR.COLABORADOR,
        descricao: `Salário (Ref. ${refStr}) - ${colab.nome_completo}`,
        categoria: CATEGORIA_COLABORADOR_CONTA_PAGAR.PAGAMENTO_SALARIO,
        empresa_id: empresaEfetivaId,
        empresa_nome: empresaEfetivaNome,
        conta_bancaria_id: contaBancariaId,
        conta_bancaria_nome: contaBancariaNome,
        data_vencimento: dataVencimentoCaixa,
        data_pagamento: dataPagamento,
        valor_previsto: saldoFinal,
        valor_pago: isPago ? saldoFinal : 0,
        saldo_pendente: isPago ? 0 : saldoFinal,
        status: isPago ? STATUS_DESPESA.PAGO : STATUS_DESPESA.PENDENTE,
        is_previsao: !isPago,
        lote_pagamento_id: lotePagamentoId,
        colaborador_id: colab.id,
        colaborador_nome: colab.nome_completo,
        mes_competencia: mesComp,
        ano_competencia: anoComp,
      });
    }

    return itens;
  },

  async _listarValesCompetencia(
    mesComp: number,
    anoComp: number,
    dataVencimentoCaixa: string,
    empresaIdFiltro?: number
  ): Promise<ContaPagarItem[]> {
    const ultimoDiaMes = new Date(Date.UTC(anoComp, mesComp, 0)).getUTCDate();
    const dataInicioMesStr = `${anoComp}-${String(mesComp).padStart(2, "0")}-01`;
    const dataFimMesStr = `${anoComp}-${String(mesComp).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    const {
      confirmacoesMap,
      turnosPorColab,
      nomesColaboradores,
      todosColabIds,
    } = await folhaContasPagarRepository.carregarDadosValesCompetencia(
      mesComp,
      anoComp,
      dataInicioMesStr,
      dataFimMesStr
    );

    const itens: ContaPagarItem[] = [];
    const refStr = `${String(mesComp).padStart(2, "0")}/${anoComp}`;

    for (const colabId of todosColabIds) {
      const turnos = turnosPorColab.get(colabId) || [];
      const confirmacao = confirmacoesMap.get(colabId);

      const valorConfigurado = turnos.reduce(
        (acc, t) => acc + Number(t.valor_adiantamento || 0),
        0
      );

      const isPago = Boolean(confirmacao);
      const valorEfetivo = confirmacao
        ? confirmacao.valor !== null && confirmacao.valor !== undefined
          ? Number(confirmacao.valor)
          : valorConfigurado
        : valorConfigurado;

      const valorFinal = parseFloat(valorEfetivo.toFixed(2));
      if (valorFinal <= 0) continue;

      const { empresaId: empresaPrevistaId, empresaNome: empresaPrevistaNome } =
        resolverEmpresaDosTurnos(turnos);

      let empresaEfetivaId = empresaPrevistaId;
      let empresaEfetivaNome = empresaPrevistaNome;
      let contaBancariaId: string | null = null;
      let contaBancariaNome: string | undefined = undefined;
      let dataPagamento: string | null = null;
      let lotePagamentoId: string | null = null;

      if (confirmacao) {
        contaBancariaId = confirmacao.conta_bancaria_id || null;
        const contaObj = unwrapSingle(confirmacao.conta_bancaria);
        contaBancariaNome = contaObj?.banco_nome;
        if (contaObj?.empresa_id) {
          empresaEfetivaId = contaObj.empresa_id;
          const empConta = unwrapSingle(contaObj.empresa);
          empresaEfetivaNome =
            empConta?.nome_fantasia || empConta?.razao_social || empresaPrevistaNome;
        }
        dataPagamento =
          confirmacao.data_pagamento || extractDateOnly(confirmacao.data_confirmacao);
        lotePagamentoId = confirmacao.lote_pagamento_id || null;
      }

      if (empresaIdFiltro && empresaEfetivaId !== empresaIdFiltro) continue;

      const nomeColab = nomesColaboradores.get(colabId) || "Colaborador";

      itens.push({
        id: `colab_vale_${colabId}_${mesComp}_${anoComp}`,
        tipo: TIPO_CONTA_PAGAR.COLABORADOR,
        descricao: `Adiantamento Salarial (Ref. ${refStr}) - ${nomeColab}`,
        categoria: CATEGORIA_COLABORADOR_CONTA_PAGAR.ADIANTAMENTO_SALARIAL,
        empresa_id: empresaEfetivaId,
        empresa_nome: empresaEfetivaNome,
        conta_bancaria_id: contaBancariaId,
        conta_bancaria_nome: contaBancariaNome,
        data_vencimento: dataVencimentoCaixa,
        data_pagamento: dataPagamento,
        valor_previsto: valorFinal,
        valor_pago: isPago ? valorFinal : 0,
        saldo_pendente: isPago ? 0 : valorFinal,
        status: isPago ? STATUS_DESPESA.PAGO : STATUS_DESPESA.PENDENTE,
        is_previsao: !isPago,
        lote_pagamento_id: lotePagamentoId,
        colaborador_id: colabId,
        colaborador_nome: nomeColab,
        mes_competencia: mesComp,
        ano_competencia: anoComp,
      });
    }

    return itens;
  },

  async liquidarItemColaborador(
    itemId: string,
    payload: {
      data_pagamento: string;
      valor_pago: number;
      conta_bancaria_id: string;
    },
    userId?: string,
    lotePagamentoId?: string | null
  ) {
    const parsed = parseItemColaboradorId(itemId);
    if (!parsed) {
      throw new AppError("Identificador de lançamento de colaborador inválido", 400);
    }

    const { subtipo, colaboradorId, mesComp, anoComp } = parsed;

    const conta = await contaBancariaRepository.getById(payload.conta_bancaria_id);
    if (!conta) {
      throw new AppError("Conta bancária de liquidação não encontrada", 404);
    }

    const responsavelId = userId || colaboradorId;

    if (subtipo === SUBTIPO_COLABORADOR_CONTA_PAGAR.VALE) {
      await financeiroService.confirmarAdiantamento(
        colaboradorId,
        mesComp,
        anoComp,
        responsavelId,
        payload.valor_pago,
        payload.conta_bancaria_id,
        payload.data_pagamento,
        lotePagamentoId || null
      );
      return { success: true, tipo: CATEGORIA_COLABORADOR_CONTA_PAGAR.ADIANTAMENTO_SALARIAL };
    }

    if (subtipo === SUBTIPO_COLABORADOR_CONTA_PAGAR.SALARIO) {
      return financeiroService.processarPagamento(
        colaboradorId,
        mesComp,
        anoComp,
        responsavelId,
        payload.conta_bancaria_id,
        payload.data_pagamento,
        lotePagamentoId || null
      );
    }

    throw new AppError("Subtipo de lançamento de colaborador desconhecido", 400);
  },

  async desfazerLiquidacaoItemColaborador(itemId: string, _userId?: string) {
    const parsed = parseItemColaboradorId(itemId);
    if (!parsed) {
      throw new AppError("Identificador de lançamento de colaborador inválido", 400);
    }

    const { subtipo, colaboradorId, mesComp, anoComp } = parsed;

    if (subtipo === SUBTIPO_COLABORADOR_CONTA_PAGAR.VALE) {
      await financeiroService.desconfirmarAdiantamento(colaboradorId, mesComp, anoComp);
      return { success: true, tipo: CATEGORIA_COLABORADOR_CONTA_PAGAR.ADIANTAMENTO_SALARIAL };
    }

    if (subtipo === SUBTIPO_COLABORADOR_CONTA_PAGAR.SALARIO) {
      await financeiroService.desfazerPagamento(colaboradorId, mesComp, anoComp);
      return { success: true, tipo: CATEGORIA_COLABORADOR_CONTA_PAGAR.PAGAMENTO_SALARIO };
    }

    throw new AppError("Subtipo de lançamento de colaborador desconhecido", 400);
  },
};
