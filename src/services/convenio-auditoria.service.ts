import { AppError } from "../errors/AppError.js";
import {
  AuditoriaConvenioResultado,
  FaturaFornecedorConvenio,
  StatusFaturaFornecedorConvenio,
  ConvenioResumoItem,
  ResumoGeralConveniosResultado,
} from "../types/database.js";
import { z } from "zod";
import {
  faturaFornecedorConvenioSchema,
  LiquidarFaturaConvenioInput,
} from "../schemas/convenio-auditoria.schema.js";
import { convenioAuditoriaRepository } from "../repositories/convenio-auditoria.repository.js";
import { PERIODICIDADE_FATURAMENTO, STATUS_FATURA_CONVENIO } from "../constants/financeiro.enum.js";
import { convenioRegrasService } from "./convenio-regras.service.js";
import { montarItemResumoConvenio } from "../utils/convenio.helper.js";

type FaturaFornecedorDTO = z.infer<typeof faturaFornecedorConvenioSchema>;

export const convenioAuditoriaService = {
  async getAuditoriaMensal(
    convenioId: string,
    mes: number,
    ano: number,
    tipoPeriodo?: string,
    numeroPeriodo?: number
  ): Promise<AuditoriaConvenioResultado> {
    const convenio = await convenioAuditoriaRepository.getConvenioBasic(convenioId);
    if (!convenio) {
      throw new AppError("Convênio não encontrado", 404);
    }

    const periodicidadeFinal =
      tipoPeriodo || convenio.periodicidade || PERIODICIDADE_FATURAMENTO.MENSAL;
    const numPeriodoFinal = numeroPeriodo || 1;

    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    let dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
    let dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    if (periodicidadeFinal === PERIODICIDADE_FATURAMENTO.QUINZENAL) {
      if (numPeriodoFinal === 1) {
        dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
        dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-15`;
      } else {
        dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-16`;
        dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;
      }
    }

    const [fatura, lancamentos] = await Promise.all([
      convenioAuditoriaRepository.getFaturaPorCompetencia(
        convenioId,
        mes,
        ano,
        periodicidadeFinal,
        numPeriodoFinal
      ),
      convenioAuditoriaRepository.listLancamentosAuditoria(convenioId, dataInicioMesStr, dataFimMesStr),
    ]);

    const {
      frotaPropria: lancamentosFrotaPropria,
      motoboys: lancamentosMotoboys,
      semVinculo: lancamentosSemVinculo,
      totalFrotaPropria,
      totalMotoboys: totalDescontadoMotoboys,
      totalSemVinculo,
      totalGeral: totalGeralLancamentos,
    } = convenioRegrasService.classificarLancamentosConvenio(lancamentos);

    const valorBaseFatura = fatura ? Number(fatura.valor_total_fatura) : totalGeralLancamentos;

    let faturaResultado = fatura;
    if (!faturaResultado && totalGeralLancamentos > 0) {
      const diaConvenios = Math.min(Math.max(convenio.dia_vencimento_padrao || 15, 1), 31);
      faturaResultado = convenioRegrasService.gerarFaturaPrevisao({
        convenioId: convenio.id,
        mes,
        ano,
        diaVencimento: diaConvenios,
        valorTotal: totalGeralLancamentos,
        empresaId: convenio.empresa_id,
        contaBancariaId: convenio.conta_bancaria_id,
        tipoPeriodo: periodicidadeFinal as "MENSAL" | "QUINZENAL" | "SEMANAL",
        numeroPeriodo: numPeriodoFinal,
        quinzena:
          periodicidadeFinal === PERIODICIDADE_FATURAMENTO.QUINZENAL ? numPeriodoFinal : null,
        dataInicioApuracao: dataInicioMesStr,
        dataFimApuracao: dataFimMesStr,
      });
    }

    const {
      saldoACargoEmbu,
      diferencaNaoIdentificada,
      temRiscoDivergencia,
      mensagemRisco,
    } = convenioRegrasService.calcularConciliacaoFatura(
      valorBaseFatura,
      totalDescontadoMotoboys,
      totalFrotaPropria,
      totalSemVinculo
    );

    return {
      convenio_id: convenio.id,
      convenio_nome: convenio.nome,
      mes_competencia: mes,
      ano_competencia: ano,
      fatura_fornecedor: faturaResultado,
      total_fatura_fornecedor: valorBaseFatura,
      total_descontado_motoboys: totalDescontadoMotoboys,
      total_frota_propria: totalFrotaPropria,
      total_sem_vinculo: totalSemVinculo,
      total_geral_lancamentos: totalGeralLancamentos,
      saldo_a_cargo_embu: saldoACargoEmbu,
      diferenca_nao_identificada: diferencaNaoIdentificada,
      tem_risco_divergencia: temRiscoDivergencia,
      mensagem_risco: mensagemRisco,
      lancamentos_motoboys: lancamentosMotoboys,
      lancamentos_frota_propria: lancamentosFrotaPropria,
      lancamentos_sem_vinculo: lancamentosSemVinculo,
    };
  },

  async salvarFaturaFornecedor(
    payload: FaturaFornecedorDTO,
    criadoPor?: string
  ): Promise<FaturaFornecedorConvenio> {
    const existente = await convenioAuditoriaRepository.getFaturaPorCompetencia(
      payload.convenio_id,
      payload.mes_competencia,
      payload.ano_competencia,
      payload.tipo_periodo,
      payload.numero_periodo
    );

    if (existente) {
      const isRevertendo =
        payload.status === STATUS_FATURA_CONVENIO.PENDENTE ||
        payload.status === STATUS_FATURA_CONVENIO.CANCELADA;

      if (isRevertendo) {
        await convenioAuditoriaRepository.deletePagamentosPorFatura(existente.id);
      }

      return convenioAuditoriaRepository.updateFatura(existente.id, {
        valor_total_fatura: payload.valor_total_fatura,
        data_vencimento: payload.data_vencimento,
        status: payload.status,
        empresa_id: payload.empresa_id !== undefined ? payload.empresa_id : null,
        conta_bancaria_id: payload.conta_bancaria_id !== undefined ? payload.conta_bancaria_id : null,
        data_pagamento: isRevertendo
          ? null
          : payload.data_pagamento !== undefined
            ? payload.data_pagamento
            : null,
        valor_pago: isRevertendo
          ? 0
          : payload.valor_pago !== undefined
            ? payload.valor_pago
            : null,
        lote_pagamento_id: isRevertendo ? null : existente.lote_pagamento_id,
        comprovante_url: payload.comprovante_url || null,
        observacoes: payload.observacoes || null,
        tipo_periodo: payload.tipo_periodo,
        numero_periodo: payload.numero_periodo,
        quinzena: payload.quinzena,
        data_inicio_apuracao: payload.data_inicio_apuracao,
        data_fim_apuracao: payload.data_fim_apuracao,
      });
    }

    return convenioAuditoriaRepository.insertFatura({
      ...payload,
      criado_por: criadoPor || null,
    });
  },

  async liquidarFaturaFornecedor(
    payload: LiquidarFaturaConvenioInput,
    criadoPor?: string
  ): Promise<FaturaFornecedorConvenio> {
    const faturaId = payload.fatura_id;
    let fatura: FaturaFornecedorConvenio | null = null;

    if (faturaId && !faturaId.startsWith("prev-")) {
      fatura = await convenioAuditoriaRepository.getFaturaById(faturaId);
    }

    if (!fatura) {
      fatura = await convenioAuditoriaRepository.getFaturaPorCompetencia(
        payload.convenio_id,
        payload.mes_competencia,
        payload.ano_competencia,
        payload.tipo_periodo,
        payload.numero_periodo
      );
    }

    if (!fatura) {
      fatura = await convenioAuditoriaRepository.insertFatura({
        convenio_id: payload.convenio_id,
        mes_competencia: payload.mes_competencia,
        ano_competencia: payload.ano_competencia,
        tipo_periodo: payload.tipo_periodo || PERIODICIDADE_FATURAMENTO.MENSAL,
        numero_periodo: payload.numero_periodo || 1,
        quinzena: payload.quinzena || 1,
        data_vencimento: payload.data_vencimento,
        valor_total_fatura: payload.valor_total_fatura,
        valor_pago: 0,
        status: STATUS_FATURA_CONVENIO.PENDENTE,
        empresa_id: payload.empresa_id,
        conta_bancaria_id: payload.conta_bancaria_id,
        criado_por: criadoPor || null,
      });
    }

    const isFaturaSemBaixaAtiva =
      fatura.status === STATUS_FATURA_CONVENIO.PENDENTE ||
      fatura.status === STATUS_FATURA_CONVENIO.CANCELADA;

    if (isFaturaSemBaixaAtiva) {
      await convenioAuditoriaRepository.deletePagamentosPorFatura(fatura.id);
    }

    await convenioAuditoriaRepository.createPagamento({
      fatura_fornecedor_id: fatura.id,
      conta_bancaria_id: payload.conta_bancaria_id,
      empresa_id: payload.empresa_id,
      data_pagamento: payload.data_pagamento,
      valor_pago: payload.valor_pago,
      observacao: payload.observacoes || null,
      criado_por: criadoPor || null,
    });

    const valorPagoAtual = isFaturaSemBaixaAtiva ? 0 : Number(fatura.valor_pago || 0);
    const novoValorPago = parseFloat((valorPagoAtual + payload.valor_pago).toFixed(2));
    const valorTotalFatura = Number(payload.valor_total_fatura || fatura.valor_total_fatura);
    const novoStatus: StatusFaturaFornecedorConvenio =
      novoValorPago >= valorTotalFatura ? STATUS_FATURA_CONVENIO.PAGA : STATUS_FATURA_CONVENIO.PAGO_PARCIAL;

    return convenioAuditoriaRepository.updateFatura(fatura.id, {
      valor_total_fatura: valorTotalFatura,
      valor_pago: novoValorPago,
      data_vencimento: payload.data_vencimento,
      data_pagamento: payload.data_pagamento,
      empresa_id: payload.empresa_id,
      conta_bancaria_id: payload.conta_bancaria_id,
      status: novoStatus,
      observacoes: payload.observacoes || fatura.observacoes || null,
    });
  },

  async atualizarStatusFatura(
    id: string,
    status: StatusFaturaFornecedorConvenio,
    observacoes?: string | null
  ): Promise<FaturaFornecedorConvenio> {
    const isRevertendo =
      status === STATUS_FATURA_CONVENIO.PENDENTE ||
      status === STATUS_FATURA_CONVENIO.CANCELADA;

    if (isRevertendo) {
      await convenioAuditoriaRepository.deletePagamentosPorFatura(id);
    }

    const updateData: Record<string, unknown> = { status };
    if (observacoes !== undefined) updateData.observacoes = observacoes;
    if (isRevertendo) {
      updateData.valor_pago = 0;
      updateData.data_pagamento = null;
      updateData.lote_pagamento_id = null;
    }

    return convenioAuditoriaRepository.updateFatura(id, updateData);
  },

  async getResumoGeralConvenios(mes: number, ano: number): Promise<ResumoGeralConveniosResultado> {
    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    const [convenios, faturas, lancamentos] = await Promise.all([
      convenioAuditoriaRepository.listConveniosParaResumo(),
      convenioAuditoriaRepository.listFaturasPorCompetencia(mes, ano),
      convenioAuditoriaRepository.listLancamentosGeraisPeriodo(dataInicioMesStr, dataFimMesStr),
    ]);

    const faturasMap = new Map<string, FaturaFornecedorConvenio>();
    faturas.forEach((f) => faturasMap.set(f.convenio_id, f));

    type LancamentoWithColab = {
      id: string;
      convenio_id: string;
      valor: number;
      moto_embu: boolean;
      colaborador_id: string | null;
      colaborador?: { id: string; nome_completo: string | null } | null;
    };

    const lancamentosPorConvenio = new Map<string, LancamentoWithColab[]>();
    lancamentos.forEach((l) => {
      if (!lancamentosPorConvenio.has(l.convenio_id)) lancamentosPorConvenio.set(l.convenio_id, []);
      lancamentosPorConvenio.get(l.convenio_id)!.push(l);
    });

    let globalConsumido = 0;
    let globalMotoboys = 0;
    let globalMotoEmbuDavid = 0;
    let globalSemVinculo = 0;
    let globalFaturas = 0;

    const conveniosNomeMap = new Map<string, string>();
    convenios.forEach((c) => conveniosNomeMap.set(c.id, c.nome));

    const topColaboradores = convenioRegrasService.extrairTopColaboradores(
      lancamentos,
      conveniosNomeMap,
      10
    );

    const conveniosItens: ConvenioResumoItem[] = convenios.map((conv) => {
      const convLancamentos = lancamentosPorConvenio.get(conv.id) || [];
      const fatura = faturasMap.get(conv.id);

      const {
        item,
        totalConsumido,
        totalMotoboys,
        totalMotoEmbuDavid,
        totalSemVinculo,
        faturaValorReal,
      } = montarItemResumoConvenio({
        conv,
        convLancamentos,
        fatura,
        mes,
        ano,
      });

      globalConsumido += totalConsumido;
      globalMotoboys += totalMotoboys;
      globalMotoEmbuDavid += totalMotoEmbuDavid;
      globalSemVinculo += totalSemVinculo;
      globalFaturas += faturaValorReal;

      return item;
    });

    const totalSaldoCargoEmbu = parseFloat((globalFaturas - globalMotoboys).toFixed(2));

    return {
      periodo: { mes, ano },
      totais: {
        total_geral_consumido: parseFloat(globalConsumido.toFixed(2)),
        total_motoboys: parseFloat(globalMotoboys.toFixed(2)),
        total_moto_embu_david: parseFloat(globalMotoEmbuDavid.toFixed(2)),
        total_sem_vinculo: parseFloat(globalSemVinculo.toFixed(2)),
        total_faturas_fornecedores: parseFloat(globalFaturas.toFixed(2)),
        total_saldo_cargo_embu: totalSaldoCargoEmbu,
      },
      top_colaboradores: topColaboradores,
      convenios: conveniosItens,
    };
  },
};
