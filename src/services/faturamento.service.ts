import { AppError } from "../errors/AppError.js";
import { FaturaCliente, LoteRecebimento, StatusFatura, AgingRecebiveisResultado } from "../types/database.js";
import { z } from "zod";
import {
  faturaClienteSchema,
  updateFaturaClienteSchema,
  loteRecebimentoSchema,
  liquidarFaturaIndividualSchema,
} from "../schemas/faturamento.schema.js";
import {
  TIPO_PERIODO_FATURA,
  PERIODICIDADE_FATURAMENTO,
  STATUS_FATURA,
  STATUS_INTERCOMPANY,
} from "../constants/financeiro.enum.js";
import { faturamentoRepository, ListFaturasFilters } from "../repositories/faturamento.repository.js";
import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";
import {
  getSemanasCompetencia,
  getQuinzenasCompetencia,
  getMensalCompetencia,
  PeriodoCalculado,
} from "../utils/periodo-faturamento.helper.js";

type CreateFaturaDTO = z.infer<typeof faturaClienteSchema>;
type UpdateFaturaDTO = z.infer<typeof updateFaturaClienteSchema>;
type LoteRecebimentoDTO = z.infer<typeof loteRecebimentoSchema>;
type LiquidarFaturaIndividualDTO = z.infer<typeof liquidarFaturaIndividualSchema>;

export const faturamentoService = {
  async calcularSugestaoMedicao(
    clienteId: number,
    mes: number,
    ano: number,
    tipoPeriodo?: string,
    numeroPeriodo?: number,
    quinzena?: number | null
  ) {
    const cliente = await faturamentoRepository.getCliente(clienteId);
    if (!cliente) {
      throw new AppError("Cliente não encontrado", 404);
    }

    const tipo = tipoPeriodo || (cliente.periodicidade || TIPO_PERIODO_FATURA.QUINZENAL);
    const num = numeroPeriodo || quinzena || 1;
    const valorBase = Number(cliente.valor_contrato_mensal || cliente.valor_base || 0);

    let periodosCalculados: PeriodoCalculado[] = [];
    let valorSugerido = valorBase;

    if (tipo === TIPO_PERIODO_FATURA.SEMANAL) {
      periodosCalculados = getSemanasCompetencia(mes, ano);
      valorSugerido = valorBase;
    } else if (tipo === TIPO_PERIODO_FATURA.MENSAL) {
      periodosCalculados = getMensalCompetencia(mes, ano, cliente.dia_vencimento_padrao || 10);
      valorSugerido = valorBase;
    } else {
      periodosCalculados = getQuinzenasCompetencia(mes, ano);
      valorSugerido = parseFloat((valorBase / 2).toFixed(2));
    }

    const periodoEncontrado =
      periodosCalculados.find((p) => p.numero_periodo === num) ||
      periodosCalculados[0] || {
        numero_periodo: num,
        data_inicio: `${ano}-${String(mes).padStart(2, "0")}-01`,
        data_fim: `${ano}-${String(mes).padStart(2, "0")}-15`,
        data_vencimento: `${ano}-${String(mes).padStart(2, "0")}-16`,
        descricao: "",
      };

    return {
      cliente_id: clienteId,
      tipo_periodo: tipo,
      numero_periodo: periodoEncontrado.numero_periodo,
      valor_base: valorBase,
      periodo: {
        data_inicio: periodoEncontrado.data_inicio,
        data_fim: periodoEncontrado.data_fim,
        data_vencimento: periodoEncontrado.data_vencimento,
      },
      dias_esperados: 0,
      dias_trabalhados: 0,
      faltas_sem_cobertura: 0,
      valor_sugerido: valorSugerido,
    };
  },

  async _materializarPrevisao(
    prevId: string,
    overrides?: Partial<FaturaCliente>,
    criadoPor?: string
  ): Promise<FaturaCliente> {
    const parts = prevId.split("_");
    const clienteId = Number(parts[1]);
    const mes = Number(parts[2]);
    const ano = Number(parts[3]);
    const numPeriodo = Number(parts[4]);

    const cliente = await faturamentoRepository.getCliente(clienteId);
    if (!cliente) {
      throw new AppError("Cliente da previsão não encontrado", 404);
    }

    const empresas = await faturamentoRepository.listEmpresasAtivas();
    const fallbackEmpresa = empresas[0] || { id: 1 };
    const empresaId = cliente.empresa_emissora_padrao_id || fallbackEmpresa.id;

    const periodicidade = cliente.periodicidade || PERIODICIDADE_FATURAMENTO.QUINZENAL;
    const valorCadastrado = Number(cliente.valor_contrato_mensal || cliente.valor_base || 0);

    let periodosCalculados: PeriodoCalculado[] = [];
    let tipoPeriodo: string = periodicidade;
    let quinzena: number | null = null;
    let valorFaturado = valorCadastrado;

    if (periodicidade === PERIODICIDADE_FATURAMENTO.SEMANAL) {
      periodosCalculados = getSemanasCompetencia(mes, ano);
      tipoPeriodo = TIPO_PERIODO_FATURA.SEMANAL;
      valorFaturado = valorCadastrado;
    } else if (periodicidade === PERIODICIDADE_FATURAMENTO.MENSAL) {
      periodosCalculados = getMensalCompetencia(mes, ano, cliente.dia_vencimento_padrao || 10);
      tipoPeriodo = TIPO_PERIODO_FATURA.MENSAL;
      valorFaturado = valorCadastrado;
    } else {
      periodosCalculados = getQuinzenasCompetencia(mes, ano);
      tipoPeriodo = TIPO_PERIODO_FATURA.QUINZENAL;
      quinzena = numPeriodo;
      if (numPeriodo === 1) {
        valorFaturado = Math.round((valorCadastrado / 2) * 100) / 100;
      } else {
        const v1 = Math.round((valorCadastrado / 2) * 100) / 100;
        valorFaturado = parseFloat((valorCadastrado - v1).toFixed(2));
      }
    }

    const periodoEncontrado =
      periodosCalculados.find((p) => p.numero_periodo === numPeriodo) ||
      periodosCalculados[0];

    const record = {
      cliente_id: cliente.id,
      empresa_id: empresaId,
      mes_competencia: mes,
      ano_competencia: ano,
      quinzena: quinzena ?? (tipoPeriodo === TIPO_PERIODO_FATURA.QUINZENAL ? numPeriodo : (numPeriodo || 1)),
      tipo_periodo: tipoPeriodo,
      numero_periodo: numPeriodo,
      data_inicio_apuracao: periodoEncontrado
        ? periodoEncontrado.data_inicio
        : `${ano}-${String(mes).padStart(2, "0")}-01`,
      data_fim_apuracao: periodoEncontrado
        ? periodoEncontrado.data_fim
        : `${ano}-${String(mes).padStart(2, "0")}-15`,
      valor_faturado: valorFaturado,
      valor_pago: 0,
      data_emissao: new Date().toISOString().split("T")[0],
      data_vencimento: periodoEncontrado
        ? periodoEncontrado.data_vencimento
        : `${ano}-${String(mes).padStart(2, "0")}-16`,
      status: STATUS_FATURA.PENDENTE,
      dias_esperados: 0,
      dias_trabalhados: 0,
      faltas_sem_cobertura: 0,
      observacoes: "Previsão contratual.",
      criado_por: criadoPor || null,
      ...overrides,
    };

    if (record.quinzena === null || record.quinzena === undefined) {
      record.quinzena = record.numero_periodo || 1;
    }

    return faturamentoRepository.createFatura(record);
  },

  async listFaturas(filtros: ListFaturasFilters): Promise<FaturaCliente[]> {
    const mes = filtros.mes;
    const ano = filtros.ano;
    const shouldFetchPrevisoes = Boolean(
      mes &&
      ano &&
      (!filtros.status || filtros.status === STATUS_FATURA.PENDENTE)
    );

    const [faturasReais, clientes, empresas] = await Promise.all([
      faturamentoRepository.listFaturas(filtros),
      shouldFetchPrevisoes ? faturamentoRepository.listClientesAtivos(filtros.cliente_id) : Promise.resolve([]),
      shouldFetchPrevisoes ? faturamentoRepository.listEmpresasAtivas() : Promise.resolve([]),
    ]);

    if (!shouldFetchPrevisoes || !mes || !ano || clientes.length === 0) {
      return faturasReais;
    }

    const empresasMap = new Map((empresas || []).map((e) => [e.id, e]));
    const fallbackEmpresa = empresas[0] || { id: 1, nome_fantasia: "Embu Express", razao_social: "Embu Express", cnpj: "" };

    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const targetMonthEnd = new Date(Date.UTC(ano, mes - 1, ultimoDiaMes, 23, 59, 59));

    const projecoes: FaturaCliente[] = [];

    for (const cliente of clientes) {
      if (cliente.created_at) {
        const dataCadastro = new Date(cliente.created_at);
        if (dataCadastro > targetMonthEnd) {
          continue;
        }
      }

      if (filtros.empresa_id && cliente.empresa_emissora_padrao_id && cliente.empresa_emissora_padrao_id !== filtros.empresa_id) {
        continue;
      }

      const periodicidade = cliente.periodicidade || PERIODICIDADE_FATURAMENTO.QUINZENAL;
      const valorMensal = Number(cliente.valor_contrato_mensal || cliente.valor_base || 0);

      const empresaObj = (cliente.empresa_emissora_padrao_id
        ? empresasMap.get(cliente.empresa_emissora_padrao_id)
        : null) || fallbackEmpresa;

      let periodosDoCliente: PeriodoCalculado[] = [];
      let tipoPeriodoFinal: string = periodicidade;

      if (periodicidade === PERIODICIDADE_FATURAMENTO.SEMANAL) {
        if (filtros.tipo_periodo && filtros.tipo_periodo !== TIPO_PERIODO_FATURA.SEMANAL) continue;
        periodosDoCliente = getSemanasCompetencia(mes, ano);
        tipoPeriodoFinal = TIPO_PERIODO_FATURA.SEMANAL;
      } else if (periodicidade === PERIODICIDADE_FATURAMENTO.MENSAL) {
        if (filtros.tipo_periodo && filtros.tipo_periodo !== TIPO_PERIODO_FATURA.MENSAL) continue;
        periodosDoCliente = getMensalCompetencia(mes, ano, cliente.dia_vencimento_padrao || 10);
        tipoPeriodoFinal = TIPO_PERIODO_FATURA.MENSAL;
      } else {
        if (filtros.tipo_periodo && filtros.tipo_periodo !== TIPO_PERIODO_FATURA.QUINZENAL) continue;
        periodosDoCliente = getQuinzenasCompetencia(mes, ano);
        tipoPeriodoFinal = TIPO_PERIODO_FATURA.QUINZENAL;
      }

      for (const p of periodosDoCliente) {
        if (filtros.numero_periodo && filtros.numero_periodo !== p.numero_periodo) {
          continue;
        }
        if (
          tipoPeriodoFinal === TIPO_PERIODO_FATURA.QUINZENAL &&
          filtros.quinzena &&
          filtros.quinzena !== p.numero_periodo
        ) {
          continue;
        }

        const existeReal = faturasReais.some(
          (f) =>
            f.cliente_id === cliente.id &&
            f.tipo_periodo === tipoPeriodoFinal &&
            (f.numero_periodo === p.numero_periodo ||
              (tipoPeriodoFinal === TIPO_PERIODO_FATURA.QUINZENAL && f.quinzena === p.numero_periodo))
        );

        if (!existeReal) {
          let valorPeriodo = valorMensal;
          if (tipoPeriodoFinal === TIPO_PERIODO_FATURA.QUINZENAL) {
            const q1Val = Math.round((valorMensal / 2) * 100) / 100;
            valorPeriodo =
              p.numero_periodo === 1 ? q1Val : parseFloat((valorMensal - q1Val).toFixed(2));
          }

          projecoes.push({
            id: `prev_${cliente.id}_${mes}_${ano}_${p.numero_periodo}`,
            cliente_id: cliente.id,
            empresa_id: empresaObj.id,
            mes_competencia: mes,
            ano_competencia: ano,
            quinzena: tipoPeriodoFinal === TIPO_PERIODO_FATURA.QUINZENAL ? p.numero_periodo : undefined,
            tipo_periodo: tipoPeriodoFinal,
            numero_periodo: p.numero_periodo,
            data_inicio_apuracao: p.data_inicio,
            data_fim_apuracao: p.data_fim,
            valor_faturado: valorPeriodo,
            valor_pago: 0,
            data_emissao: `${ano}-${String(mes).padStart(2, "0")}-01`,
            data_vencimento: p.data_vencimento,
            status: STATUS_FATURA.PENDENTE,
            dias_esperados: 0,
            dias_trabalhados: 0,
            faltas_sem_cobertura: 0,
            observacoes: "Previsão contratual",
            is_previsao: true,
            cliente: { id: cliente.id, nome_fantasia: cliente.nome_fantasia },
            empresa: empresaObj,
            recebimentos: [],
          } as unknown as FaturaCliente);
        }
      }
    }

    const resultado = [...faturasReais, ...projecoes];
    resultado.sort((a, b) => b.data_vencimento.localeCompare(a.data_vencimento));
    return resultado;
  },

  async getFaturaById(id: string): Promise<FaturaCliente> {
    if (id.startsWith("prev_")) {
      return this._materializarPrevisao(id);
    }
    const data = await faturamentoRepository.getFaturaById(id);
    if (!data) throw new AppError("Fatura não encontrada", 404);
    return data;
  },

  async createFatura(data: CreateFaturaDTO, criadoPor?: string): Promise<FaturaCliente> {
    return faturamentoRepository.createFatura({
      ...data,
      quinzena: data.quinzena ?? (data.numero_periodo || 1),
      criado_por: criadoPor || null,
    });
  },

  async updateFatura(id: string, data: UpdateFaturaDTO): Promise<FaturaCliente> {
    if (id.startsWith("prev_")) {
      return this._materializarPrevisao(id, data as Partial<FaturaCliente>);
    }
    const exists = await faturamentoRepository.getFaturaById(id);
    if (!exists) throw new AppError("Fatura não encontrada", 404);
    return faturamentoRepository.updateFatura(id, data as Record<string, unknown>);
  },

  async deleteFatura(id: string): Promise<void> {
    if (id.startsWith("prev_")) {
      await this._materializarPrevisao(id, { status: STATUS_FATURA.CANCELADA });
      return;
    }
    const exists = await faturamentoRepository.getFaturaById(id);
    if (!exists) throw new AppError("Fatura não encontrada", 404);
    await faturamentoRepository.deleteFatura(id);
  },

  async liquidarFaturaIndividual(
    faturaId: string,
    payload: LiquidarFaturaIndividualDTO,
    criadoPor?: string
  ): Promise<FaturaCliente> {
    if (faturaId.startsWith("prev_")) {
      const materializada = await this._materializarPrevisao(faturaId, undefined, criadoPor);
      faturaId = materializada.id;
    }

    const { conta_bancaria_id, data_pagamento, valor_pago, observacao } = payload;

    const fatura = await faturamentoRepository.getFaturaById(faturaId);
    if (!fatura) {
      throw new AppError("Fatura não encontrada", 404);
    }

    const contaBancaria = await contaBancariaRepository.getById(conta_bancaria_id);
    if (!contaBancaria) {
      throw new AppError("Conta bancária não encontrada", 404);
    }

    const recebimento = await faturamentoRepository.createRecebimento({
      fatura_id: fatura.id,
      conta_bancaria_id,
      data_recebimento: data_pagamento,
      valor_alocado: valor_pago,
      observacao: observacao || null,
      criado_por: criadoPor || null,
    });

    const valorPagoAtual = Number(fatura.valor_pago || 0);
    const novoValorPago = parseFloat((valorPagoAtual + valor_pago).toFixed(2));
    const valorFaturado = Number(fatura.valor_faturado || 0);
    const novoStatus: StatusFatura =
      novoValorPago >= valorFaturado ? STATUS_FATURA.LIQUIDADA : STATUS_FATURA.PAGO_PARCIAL;

    const faturaAtualizada = await faturamentoRepository.updateFatura(fatura.id, {
      valor_pago: novoValorPago,
      status: novoStatus,
    });

    if (Number(fatura.empresa_id) !== Number(contaBancaria.empresa_id)) {
      await faturamentoRepository.createTransferenciaIntercompany({
        fatura_recebimento_id: recebimento.id,
        empresa_credora_id: fatura.empresa_id,
        empresa_devedora_id: contaBancaria.empresa_id,
        valor: valor_pago,
        data_fato_gerador: data_pagamento,
        status: STATUS_INTERCOMPANY.PENDENTE_ACERTO,
        observacao: `Recebimento da fatura #${fatura.id.substring(0, 8)} recebido na conta do banco ${contaBancaria.banco_nome}`,
      });
    }

    return faturaAtualizada;
  },

  async processarLoteRecebimento(payload: LoteRecebimentoDTO, criadoPor?: string): Promise<LoteRecebimento> {
    const { conta_bancaria_destino_id, data_deposito, valor_total_depositado, observacao, itens } = payload;

    const contaBancaria = await contaBancariaRepository.getById(conta_bancaria_destino_id);
    if (!contaBancaria) {
      throw new AppError("Conta bancária de destino não encontrada", 404);
    }

    const somaItens = itens.reduce((acc, item) => acc + item.valor_alocado, 0);
    if (Math.abs(somaItens - valor_total_depositado) > 0.05) {
      throw new AppError("A soma dos valores alocados difere do total depositado no lote", 400);
    }

    const lote = await faturamentoRepository.createLote({
      conta_bancaria_destino_id,
      data_deposito,
      valor_total_depositado,
      observacao: observacao || null,
      criado_por: criadoPor || null,
    });

    for (const item of itens) {
      if (item.fatura_id.startsWith("prev_")) {
        const materializada = await this._materializarPrevisao(item.fatura_id, undefined, criadoPor);
        item.fatura_id = materializada.id;
      }

      const fatura = await faturamentoRepository.getFaturaById(item.fatura_id);
      if (!fatura) {
        throw new AppError(`Fatura ${item.fatura_id} não encontrada`, 404);
      }

      const recebimento = await faturamentoRepository.createRecebimento({
        lote_recebimento_id: lote.id,
        fatura_id: item.fatura_id,
        conta_bancaria_id: conta_bancaria_destino_id,
        data_recebimento: data_deposito,
        valor_alocado: item.valor_alocado,
        observacao: item.observacao || null,
        criado_por: criadoPor || null,
      });

      const novoValorPago = parseFloat((Number(fatura.valor_pago || 0) + item.valor_alocado).toFixed(2));
      const valorFaturadoBase = Number(fatura.valor_faturado || 0);
      const valorFaturadoFinal = Math.max(valorFaturadoBase, novoValorPago);
      const novoStatus: StatusFatura = novoValorPago >= valorFaturadoFinal ? STATUS_FATURA.LIQUIDADA : STATUS_FATURA.PAGO_PARCIAL;

      await faturamentoRepository.updateFatura(fatura.id, {
        valor_faturado: valorFaturadoFinal,
        valor_pago: novoValorPago,
        status: novoStatus,
      });

      if (Number(fatura.empresa_id) !== Number(contaBancaria.empresa_id)) {
        await faturamentoRepository.createTransferenciaIntercompany({
          fatura_recebimento_id: recebimento.id,
          empresa_credora_id: fatura.empresa_id,
          empresa_devedora_id: contaBancaria.empresa_id,
          valor: item.valor_alocado,
          data_fato_gerador: data_deposito,
          status: STATUS_INTERCOMPANY.PENDENTE_ACERTO,
          observacao: `Recebimento da fatura ${fatura.id} caiu na conta do banco ${contaBancaria.banco_nome}`,
        });
      }
    }

    return lote;
  },

  async getAgingRecebiveis(filtros: {
    mes?: number;
    ano?: number;
    empresa_id?: number;
  }): Promise<AgingRecebiveisResultado> {
    const faturas = await faturamentoRepository.listFaturasAging(filtros);

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);

    let capitalGiroRetido = 0;
    let totalAVencer = 0;

    let qtdAVencer = 0;
    let valAVencer = 0;
    let qtdAtraso1_15 = 0;
    let valAtraso1_15 = 0;
    let qtdAtraso16_30 = 0;
    let valAtraso16_30 = 0;
    let qtdAtrasoMaior30 = 0;
    let valAtrasoMaior30 = 0;

    const faturasAtrasadas: FaturaCliente[] = [];

    faturas.forEach((fatura) => {
      const valorFaturado = Number(fatura.valor_faturado || 0);
      const valorPago = Number(fatura.valor_pago || 0);
      const saldoAberto = parseFloat(Math.max(0, valorFaturado - valorPago).toFixed(2));

      if (saldoAberto <= 0) return;

      const dataVenc = new Date(`${fatura.data_vencimento}T00:00:00Z`);
      const diffMs = hoje.getTime() - dataVenc.getTime();
      const diasAtraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diasAtraso <= 0) {
        qtdAVencer++;
        valAVencer += saldoAberto;
        totalAVencer += saldoAberto;
      } else {
        faturasAtrasadas.push({ ...fatura, dias_atraso: diasAtraso } as unknown as FaturaCliente);
        capitalGiroRetido += saldoAberto;

        if (diasAtraso <= 15) {
          qtdAtraso1_15++;
          valAtraso1_15 += saldoAberto;
        } else if (diasAtraso <= 30) {
          qtdAtraso16_30++;
          valAtraso16_30 += saldoAberto;
        } else {
          qtdAtrasoMaior30++;
          valAtrasoMaior30 += saldoAberto;
        }
      }
    });

    const totalVencido = parseFloat(capitalGiroRetido.toFixed(2));
    const totalGeralPendente = parseFloat((totalAVencer + totalVencido).toFixed(2));

    return {
      periodo: { mes: filtros.mes, ano: filtros.ano },
      capital_giro_retido_rua: totalVencido,
      total_a_vencer: parseFloat(totalAVencer.toFixed(2)),
      total_vencido: totalVencido,
      total_geral_pendente: totalGeralPendente,
      faixas: [
        {
          faixa: "A_VENCER",
          descricao: "A Vencer",
          quantidade_faturas: qtdAVencer,
          valor_total: parseFloat(valAVencer.toFixed(2)),
        },
        {
          faixa: "ATRASO_1_15",
          descricao: "1 a 15 dias",
          quantidade_faturas: qtdAtraso1_15,
          valor_total: parseFloat(valAtraso1_15.toFixed(2)),
        },
        {
          faixa: "ATRASO_16_30",
          descricao: "16 a 30 dias",
          quantidade_faturas: qtdAtraso16_30,
          valor_total: parseFloat(valAtraso16_30.toFixed(2)),
        },
        {
          faixa: "ATRASO_MAIOR_30",
          descricao: "Mais de 30 dias",
          quantidade_faturas: qtdAtrasoMaior30,
          valor_total: parseFloat(valAtrasoMaior30.toFixed(2)),
        },
      ],
      faturas_atrasadas: faturasAtrasadas,
    };
  },
};
