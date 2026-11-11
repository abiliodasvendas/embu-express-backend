import { AppError } from "../errors/AppError.js";
import { DespesaOperacional } from "../types/database.js";
import { STATUS_DESPESA, DESPESA_ESCOPO_ACAO, DespesaEscopoAcaoType } from "../constants/financeiro.enum.js";
import { z } from "zod";
import { despesaOperacionalSchema, updateDespesaOperacionalSchema } from "../schemas/despesa.schema.js";
import { despesaRepository, ListDespesasFilters } from "../repositories/despesa.repository.js";
import {
  addMonthsFinancial,
  gerarProjecoesDespesasRecorrentes,
  montarParcelasDespesa,
  montarPayloadMaterializacaoDespesa,
} from "../utils/despesa-recorrencia.helper.js";

type CreateDespesaDTO = z.infer<typeof despesaOperacionalSchema>;
type UpdateDespesaDTO = z.infer<typeof updateDespesaOperacionalSchema>;

export const despesaService = {
  async _materializarPrevisaoDespesa(
    prevId: string,
    overrides?: Partial<DespesaOperacional>,
    criadoPor?: string
  ): Promise<DespesaOperacional> {
    const parts = prevId.split("_");
    const recorrenteId = parts[2];
    const mes = Number(parts[3]);
    const ano = Number(parts[4]);

    const master = await despesaRepository.getById(recorrenteId);
    if (!master) {
      throw new AppError("Despesa recorrente de origem não encontrada", 404);
    }

    const record = montarPayloadMaterializacaoDespesa(master, mes, ano, overrides, criadoPor);
    return despesaRepository.insert(record);
  },

  async list(filtros: ListDespesasFilters): Promise<DespesaOperacional[]> {
    const mes = filtros.mes;
    const ano = filtros.ano;
    const shouldFetchRecorrentes = Boolean(
      mes &&
      ano &&
      (!filtros.status || filtros.status === STATUS_DESPESA.PENDENTE)
    );

    const [reais, recorrentesBrutas] = await Promise.all([
      despesaRepository.list(filtros),
      shouldFetchRecorrentes
        ? despesaRepository.listRecorrentesAtivas(filtros.empresa_id, filtros.categoria)
        : Promise.resolve([]),
    ]);

    if (!shouldFetchRecorrentes || !mes || !ano) {
      return reais;
    }

    const recorrentes = recorrentesBrutas.filter((r) => !r.recorrencia_origem_id);
    if (recorrentes.length === 0) {
      return reais;
    }

    const projecoes = gerarProjecoesDespesasRecorrentes(recorrentes, reais, mes, ano);
    const combinado = [...reais, ...projecoes];
    combinado.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
    return combinado;
  },

  async getById(id: string): Promise<DespesaOperacional> {
    if (id.startsWith("prev_desp_")) {
      return this._materializarPrevisaoDespesa(id);
    }
    const data = await despesaRepository.getById(id);
    if (!data) throw new AppError("Despesa não encontrada", 404);
    return data;
  },

  async create(data: CreateDespesaDTO, criadoPor?: string): Promise<DespesaOperacional> {
    const isParcelado = Boolean(data.is_parcelado && data.quantidade_parcelas && data.quantidade_parcelas > 1);
    const isRecorrente = Boolean(!isParcelado && data.is_recorrente);

    if (isParcelado) {
      const despesasParaInserir = montarParcelasDespesa(data, criadoPor);
      const insertedList = await despesaRepository.insertMany(despesasParaInserir);
      return insertedList[0];
    }

    if (isRecorrente) {
      const diaOriginal = Number(data.data_vencimento.split("-")[2]) || 10;
      return despesaRepository.insert({
        empresa_id: data.empresa_id,
        conta_bancaria_id: data.conta_bancaria_id || null,
        categoria: data.categoria,
        descricao: data.descricao,
        mes_competencia: data.mes_competencia,
        ano_competencia: data.ano_competencia,
        valor_previsto: data.valor_previsto,
        valor_pago: data.valor_pago,
        data_vencimento: data.data_vencimento,
        data_pagamento: data.data_pagamento,
        status: data.status,
        is_holding: Boolean(data.is_holding),
        is_recorrente: true,
        dia_vencimento_base: diaOriginal,
        criado_por: criadoPor || null,
      });
    }

    return despesaRepository.insert({
      empresa_id: data.empresa_id,
      conta_bancaria_id: data.conta_bancaria_id || null,
      categoria: data.categoria,
      descricao: data.descricao,
      mes_competencia: data.mes_competencia,
      ano_competencia: data.ano_competencia,
      valor_previsto: data.valor_previsto,
      valor_pago: data.valor_pago,
      data_vencimento: data.data_vencimento,
      data_pagamento: data.data_pagamento,
      status: data.status,
      is_holding: Boolean(data.is_holding),
      criado_por: criadoPor || null,
    });
  },

  async update(id: string, data: UpdateDespesaDTO): Promise<DespesaOperacional> {
    const { escopo = DESPESA_ESCOPO_ACAO.UNICA, ...payloadClean } = data;
    const normalizedPayload: Record<string, unknown> = { ...payloadClean };

    if (
      normalizedPayload.status &&
      normalizedPayload.status !== STATUS_DESPESA.PAGO
    ) {
      normalizedPayload.valor_pago = 0;
      normalizedPayload.data_pagamento = null;
      normalizedPayload.lote_pagamento_id = null;
    }

    if (id.startsWith("prev_desp_")) {
      const materializada = await this._materializarPrevisaoDespesa(id, normalizedPayload as Partial<DespesaOperacional>);
      if (escopo === DESPESA_ESCOPO_ACAO.UNICA) {
        return materializada;
      }
      return this.update(materializada.id, { ...data, escopo });
    }

    const exists = await despesaRepository.getById(id);
    if (!exists) throw new AppError("Despesa não encontrada", 404);

    if (escopo === DESPESA_ESCOPO_ACAO.UNICA || (!exists.grupo_parcelamento_id && !exists.is_recorrente && !exists.recorrencia_origem_id)) {
      return despesaRepository.update(id, normalizedPayload);
    }

    if (exists.grupo_parcelamento_id) {
      const minParcela = escopo === DESPESA_ESCOPO_ACAO.FUTURAS ? (exists.numero_parcela || 1) : undefined;
      const parcelasAfetadas = await despesaRepository.getParcelasAfetadas(exists.grupo_parcelamento_id, minParcela);
      const baseNumero = exists.numero_parcela || 1;
      const baseDateStr = payloadClean.data_vencimento;

      const updatedIds = new Set<string>();
      for (const p of parcelasAfetadas) {
        const itemPayload: Record<string, unknown> = { ...normalizedPayload };
        if (baseDateStr) {
          const offsetMeses = (p.numero_parcela || 1) - baseNumero;
          itemPayload.data_vencimento = addMonthsFinancial(baseDateStr, Math.max(0, offsetMeses));
        }
        await despesaRepository.update(p.id, itemPayload);
        updatedIds.add(p.id);
      }

      if (!updatedIds.has(id)) {
        await despesaRepository.update(id, normalizedPayload);
      }

      const updated = await despesaRepository.getById(id);
      return updated || exists;
    }

    const masterId = exists.recorrencia_origem_id || exists.id;
    const minAno = escopo === DESPESA_ESCOPO_ACAO.FUTURAS ? exists.ano_competencia : 0;
    const minMes = escopo === DESPESA_ESCOPO_ACAO.FUTURAS ? exists.mes_competencia : 0;

    const afetadas = await despesaRepository.getRecorrentesAfetadas(masterId, minAno, minMes);
    const updatedIds = new Set<string>();
    for (const af of afetadas) {
      const itemPayload: Record<string, unknown> = { ...normalizedPayload };
      if (payloadClean.data_vencimento) {
        const diaOriginal = Number(payloadClean.data_vencimento.split("-")[2]) || 10;
        const ultimoDiaDoMes = new Date(Date.UTC(af.ano_competencia, af.mes_competencia, 0)).getUTCDate();
        const diaVenc = Math.min(diaOriginal, ultimoDiaDoMes);
        itemPayload.data_vencimento = `${af.ano_competencia}-${String(af.mes_competencia).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;
      }
      await despesaRepository.update(af.id, itemPayload);
      updatedIds.add(af.id);
    }

    if (!updatedIds.has(id)) {
      await despesaRepository.update(id, normalizedPayload);
    }

    const updated = await despesaRepository.getById(id);
    return updated || exists;
  },

  async delete(id: string, escopo: DespesaEscopoAcaoType = DESPESA_ESCOPO_ACAO.UNICA): Promise<void> {
    if (id.startsWith("prev_desp_")) {
      const parts = id.split("_");
      const recorrenteId = parts[2];
      const mes = Number(parts[3]);
      const ano = Number(parts[4]);

      if (escopo === DESPESA_ESCOPO_ACAO.UNICA) {
        await this._materializarPrevisaoDespesa(id, { status: STATUS_DESPESA.CANCELADO });
        return;
      }
      if (escopo === DESPESA_ESCOPO_ACAO.FUTURAS) {
        await despesaRepository.deleteRecorrenciaFuturas(recorrenteId, ano, mes);
        return;
      }
      if (escopo === DESPESA_ESCOPO_ACAO.TODAS) {
        await despesaRepository.deleteRecorrenciaTodas(recorrenteId);
        return;
      }
    }

    const exists = await despesaRepository.getById(id);
    if (!exists) throw new AppError("Despesa não encontrada", 404);

    if (escopo === DESPESA_ESCOPO_ACAO.UNICA || (!exists.grupo_parcelamento_id && !exists.is_recorrente && !exists.recorrencia_origem_id)) {
      await despesaRepository.delete(id);
      return;
    }

    if (exists.grupo_parcelamento_id) {
      if (escopo === DESPESA_ESCOPO_ACAO.FUTURAS) {
        await despesaRepository.deleteByParcelamento(exists.grupo_parcelamento_id, exists.numero_parcela || 1);
        return;
      }
      if (escopo === DESPESA_ESCOPO_ACAO.TODAS) {
        await despesaRepository.deleteByParcelamento(exists.grupo_parcelamento_id);
        return;
      }
    }

    const masterId = exists.recorrencia_origem_id || exists.id;
    if (escopo === DESPESA_ESCOPO_ACAO.FUTURAS) {
      await despesaRepository.deleteRecorrenciaFuturas(masterId, exists.ano_competencia, exists.mes_competencia);
      return;
    }
    if (escopo === DESPESA_ESCOPO_ACAO.TODAS) {
      await despesaRepository.deleteRecorrenciaTodas(masterId);
      return;
    }

    await despesaRepository.delete(id);
  },

  async marcarPaga(id: string, dataPagamento: string, valorPago?: number, contaBancariaId?: string): Promise<DespesaOperacional> {
    if (id.startsWith("prev_desp_")) {
      return this._materializarPrevisaoDespesa(id, {
        status: STATUS_DESPESA.PAGO,
        data_pagamento: dataPagamento,
        valor_pago: valorPago,
        conta_bancaria_id: contaBancariaId || null,
      });
    }
    const despesa = await this.getById(id);
    const valor = valorPago !== undefined ? valorPago : despesa.valor_previsto;

    return despesaRepository.update(id, {
      status: STATUS_DESPESA.PAGO,
      data_pagamento: dataPagamento,
      valor_pago: valor,
      conta_bancaria_id: contaBancariaId || despesa.conta_bancaria_id || null,
    });
  },

  async adiarDespesa(id: string): Promise<DespesaOperacional> {
    const exists = await despesaRepository.getById(id);
    if (!exists) throw new AppError("Despesa não encontrada", 404);
    return despesaRepository.update(id, {
      status: STATUS_DESPESA.ADIADA,
      valor_pago: 0,
      data_pagamento: null,
      lote_pagamento_id: null,
    });
  },

  async desfazerPagamento(id: string): Promise<DespesaOperacional> {
    const exists = await despesaRepository.getById(id);
    if (!exists) throw new AppError("Despesa não encontrada", 404);
    return despesaRepository.update(id, {
      status: STATUS_DESPESA.PENDENTE,
      valor_pago: 0,
      data_pagamento: null,
      conta_bancaria_id: null,
      lote_pagamento_id: null,
    });
  },
};
