import { AppError } from "../errors/AppError.js";
import {
  AuditoriaConvenioResultado,
  FaturaFornecedorConvenio,
  FaturaFornecedorPagamento,
  LancamentoConvenio,
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

type FaturaFornecedorDTO = z.infer<typeof faturaFornecedorConvenioSchema>;

const DAVID_CAITITE_ID = "e7c2c19c-3b36-402a-9e73-9a3c3c3c3c3c";

const isDavidOuMotoEmbu = (l: {
  moto_embu: boolean;
  colaborador_id: string | null;
  colaborador?: { nome_completo?: string | null } | null;
}) =>
  l.moto_embu ||
  l.colaborador_id === DAVID_CAITITE_ID ||
  Boolean(l.colaborador?.nome_completo && l.colaborador.nome_completo.toUpperCase().includes("DAVID CAITIT"));

export const convenioAuditoriaService = {
  async getAuditoriaMensal(
    convenioId: string,
    mes: number,
    ano: number
  ): Promise<AuditoriaConvenioResultado> {
    const convenio = await convenioAuditoriaRepository.getConvenioBasic(convenioId);
    if (!convenio) {
      throw new AppError("Convênio não encontrado", 404);
    }

    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    const [fatura, lancamentos] = await Promise.all([
      convenioAuditoriaRepository.getFaturaPorCompetencia(convenioId, mes, ano),
      convenioAuditoriaRepository.listLancamentosAuditoria(convenioId, dataInicioMesStr, dataFimMesStr),
    ]);

    const lancamentosFrotaPropria = lancamentos.filter(isDavidOuMotoEmbu);
    const lancamentosMotoboys = lancamentos.filter((l) => !isDavidOuMotoEmbu(l) && l.colaborador_id);
    const lancamentosSemVinculo = lancamentos.filter((l) => !isDavidOuMotoEmbu(l) && !l.colaborador_id);

    const totalDescontadoMotoboys = parseFloat(
      lancamentosMotoboys.reduce((acc, l) => acc + Number(l.valor || 0), 0).toFixed(2)
    );
    const totalFrotaPropria = parseFloat(
      lancamentosFrotaPropria.reduce((acc, l) => acc + Number(l.valor || 0), 0).toFixed(2)
    );
    const totalSemVinculo = parseFloat(
      lancamentosSemVinculo.reduce((acc, l) => acc + Number(l.valor || 0), 0).toFixed(2)
    );
    const totalGeralLancamentos = parseFloat(
      (totalDescontadoMotoboys + totalFrotaPropria + totalSemVinculo).toFixed(2)
    );

    const valorBaseFatura = fatura ? Number(fatura.valor_total_fatura) : totalGeralLancamentos;

    let faturaResultado = fatura;
    if (!faturaResultado && totalGeralLancamentos > 0) {
      const mesVenc = mes === 12 ? 1 : mes + 1;
      const anoVenc = mes === 12 ? ano + 1 : ano;
      const dataVencimentoPrevisao = `${anoVenc}-${String(mesVenc).padStart(2, "0")}-15`;
      faturaResultado = {
        id: `prev-${convenio.id}-${mes}-${ano}`,
        convenio_id: convenio.id,
        mes_competencia: mes,
        ano_competencia: ano,
        data_vencimento: dataVencimentoPrevisao,
        valor_total_fatura: totalGeralLancamentos,
        status: "PENDENTE",
        empresa_id: convenio.empresa_id || null,
        conta_bancaria_id: convenio.conta_bancaria_id || null,
        valor_pago: null,
        data_pagamento: null,
        observacoes: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        criado_por: null,
        is_previsao: true,
      };
    }

    const totalFaturaFornecedor = valorBaseFatura;
    const saldoACargoEmbu = parseFloat(
      Math.max(0, totalFaturaFornecedor - totalDescontadoMotoboys).toFixed(2)
    );
    const diferencaNaoIdentificada = parseFloat(
      (saldoACargoEmbu - totalFrotaPropria).toFixed(2)
    );

    const temRiscoDivergencia = totalSemVinculo > 0 || Math.abs(diferencaNaoIdentificada) > 0.05;
    const mensagemRisco = temRiscoDivergencia
      ? `Atenção à conciliação: Foi identificada uma divergência de R$ ${Math.abs(diferencaNaoIdentificada).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} entre o saldo a cargo da Embu e as despesas da frota própria, ou lançamentos sem vínculo. Verifique os lançamentos antes da quitação.`
      : null;

    return {
      convenio_id: convenio.id,
      convenio_nome: convenio.nome,
      mes_competencia: mes,
      ano_competencia: ano,
      fatura_fornecedor: faturaResultado,
      total_fatura_fornecedor: totalFaturaFornecedor,
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
      payload.ano_competencia
    );

    if (existente) {
      return convenioAuditoriaRepository.updateFatura(existente.id, {
        valor_total_fatura: payload.valor_total_fatura,
        data_vencimento: payload.data_vencimento,
        status: payload.status,
        empresa_id: payload.empresa_id !== undefined ? payload.empresa_id : null,
        conta_bancaria_id: payload.conta_bancaria_id !== undefined ? payload.conta_bancaria_id : null,
        data_pagamento: payload.data_pagamento !== undefined ? payload.data_pagamento : null,
        valor_pago: payload.valor_pago !== undefined ? payload.valor_pago : null,
        comprovante_url: payload.comprovante_url || null,
        observacoes: payload.observacoes || null,
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
        payload.ano_competencia
      );
    }

    if (!fatura) {
      fatura = await convenioAuditoriaRepository.insertFatura({
        convenio_id: payload.convenio_id,
        mes_competencia: payload.mes_competencia,
        ano_competencia: payload.ano_competencia,
        data_vencimento: payload.data_vencimento,
        valor_total_fatura: payload.valor_total_fatura,
        valor_pago: 0,
        status: "PENDENTE",
        empresa_id: payload.empresa_id,
        conta_bancaria_id: payload.conta_bancaria_id,
        criado_por: criadoPor || null,
      });
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

    const valorPagoAtual = Number(fatura.valor_pago || 0);
    const novoValorPago = parseFloat((valorPagoAtual + payload.valor_pago).toFixed(2));
    const valorTotalFatura = Number(payload.valor_total_fatura || fatura.valor_total_fatura);
    const novoStatus: StatusFaturaFornecedorConvenio =
      novoValorPago >= valorTotalFatura ? "PAGA" : "PAGO_PARCIAL";

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
    const updateData: { status: StatusFaturaFornecedorConvenio; observacoes?: string | null } = { status };
    if (observacoes !== undefined) updateData.observacoes = observacoes;

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

    lancamentos.forEach((l) => {
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
    });

    const topColaboradores = Array.from(colaboradoresMap.values())
      .map((c) => ({
        colaborador_id: c.colaborador_id,
        nome_completo: c.nome_completo,
        total_gasto: parseFloat(c.total_gasto.toFixed(2)),
        quantidade_lancamentos: c.quantidade_lancamentos,
        convenios_utilizados: Array.from(c.convenios_utilizados),
      }))
      .sort((a, b) => b.total_gasto - a.total_gasto)
      .slice(0, 10);

    const conveniosItens: ConvenioResumoItem[] = convenios.map((conv) => {
      const convLancamentos = lancamentosPorConvenio.get(conv.id) || [];
      const fatura = faturasMap.get(conv.id);

      let totalConsumido = 0;
      let totalMotoboys = 0;
      let totalMotoEmbuDavid = 0;
      let totalSemVinculo = 0;
      const distinctColabs = new Set<string>();

      convLancamentos.forEach((l) => {
        const v = Number(l.valor || 0);
        totalConsumido += v;
        if (isDavidOuMotoEmbu(l)) {
          totalMotoEmbuDavid += v;
        } else if (l.colaborador_id) {
          totalMotoboys += v;
          distinctColabs.add(l.colaborador_id);
        } else {
          totalSemVinculo += v;
        }
      });

      globalConsumido += totalConsumido;
      globalMotoboys += totalMotoboys;
      globalMotoEmbuDavid += totalMotoEmbuDavid;
      globalSemVinculo += totalSemVinculo;

      let faturaItem: ConvenioResumoItem["fatura_fornecedor"] = null;
      if (fatura) {
        const faturaValor = Number(fatura.valor_total_fatura || 0);
        globalFaturas += faturaValor;
        faturaItem = {
          id: fatura.id,
          valor_total_fatura: faturaValor,
          data_vencimento: fatura.data_vencimento,
          status: fatura.status as StatusFaturaFornecedorConvenio,
          saldo_embu: parseFloat((faturaValor - totalMotoboys).toFixed(2)),
          empresa_id: fatura.empresa_id,
          conta_bancaria_id: fatura.conta_bancaria_id,
          valor_pago: fatura.valor_pago ? Number(fatura.valor_pago) : null,
          data_pagamento: fatura.data_pagamento || null,
          is_previsao: false,
          pagamentos: (fatura.pagamentos || []) as FaturaFornecedorPagamento[],
        };
      } else if (totalConsumido > 0) {
        const mesVenc = mes === 12 ? 1 : mes + 1;
        const anoVenc = mes === 12 ? ano + 1 : ano;
        const dataVencimentoPrevisao = `${anoVenc}-${String(mesVenc).padStart(2, "0")}-15`;
        const faturaValor = parseFloat(totalConsumido.toFixed(2));
        globalFaturas += faturaValor;
        faturaItem = {
          id: `prev-${conv.id}-${mes}-${ano}`,
          valor_total_fatura: faturaValor,
          data_vencimento: dataVencimentoPrevisao,
          status: "PENDENTE",
          saldo_embu: parseFloat(totalMotoEmbuDavid.toFixed(2)),
          empresa_id: conv.empresa_id || null,
          conta_bancaria_id: conv.conta_bancaria_id || null,
          valor_pago: null,
          data_pagamento: null,
          is_previsao: true,
          pagamentos: [],
        };
      }

      const ticketMedio =
        convLancamentos.length > 0
          ? parseFloat((totalConsumido / convLancamentos.length).toFixed(2))
          : 0;

      return {
        id: conv.id,
        nome: conv.nome,
        ativo: conv.ativo,
        empresa_id: conv.empresa_id || null,
        conta_bancaria_id: conv.conta_bancaria_id || null,
        total_consumido: parseFloat(totalConsumido.toFixed(2)),
        total_motoboys: parseFloat(totalMotoboys.toFixed(2)),
        total_moto_embu_david: parseFloat(totalMotoEmbuDavid.toFixed(2)),
        total_sem_vinculo: parseFloat(totalSemVinculo.toFixed(2)),
        quantidade_lancamentos: convLancamentos.length,
        total_colaboradores_distintos: distinctColabs.size,
        ticket_medio: ticketMedio,
        fatura_fornecedor: faturaItem,
      };
    });

    const totalSaldoEmbu = parseFloat((globalFaturas - globalMotoboys).toFixed(2));

    const distribuicaoPercentual = conveniosItens
      .filter((c) => c.total_consumido > 0)
      .map((c) => ({
        convenio_id: c.id,
        nome: c.nome,
        percentual:
          globalConsumido > 0
            ? parseFloat(((c.total_consumido / globalConsumido) * 100).toFixed(1))
            : 0,
        total: c.total_consumido,
      }))
      .sort((a, b) => b.total - a.total);

    return {
      periodo: { mes, ano },
      totais: {
        total_geral_consumido: parseFloat(globalConsumido.toFixed(2)),
        total_motoboys: parseFloat(globalMotoboys.toFixed(2)),
        total_moto_embu_david: parseFloat(globalMotoEmbuDavid.toFixed(2)),
        total_sem_vinculo: parseFloat(globalSemVinculo.toFixed(2)),
        total_faturas_fornecedores: parseFloat(globalFaturas.toFixed(2)),
        total_saldo_cargo_embu: totalSaldoEmbu,
      },
      convenios: conveniosItens,
      top_colaboradores: topColaboradores,
      distribuicao_percentual: distribuicaoPercentual,
    };
  },
};