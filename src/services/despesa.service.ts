import { AppError } from "../errors/AppError.js";
import { DespesaOperacional, CategoriaDespesa, StatusDespesa } from "../types/database.js";
import { STATUS_DESPESA } from "../constants/financeiro.enum.js";
import { z } from "zod";
import { despesaOperacionalSchema, updateDespesaOperacionalSchema } from "../schemas/despesa.schema.js";
import { despesaRepository, ListDespesasFilters } from "../repositories/despesa.repository.js";
import crypto from "crypto";

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

    const diaOriginal = master.dia_vencimento_base || Number(master.data_vencimento.split("-")[2]) || 10;
    const ultimoDiaDoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const diaVenc = Math.min(diaOriginal, ultimoDiaDoMes);
    const novoVencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;

    const record = {
      empresa_id: master.empresa_id,
      categoria: master.categoria,
      descricao: master.descricao,
      mes_competencia: mes,
      ano_competencia: ano,
      valor_previsto: master.valor_previsto,
      valor_pago: 0,
      data_vencimento: novoVencimento,
      data_pagamento: null,
      status: STATUS_DESPESA.PENDENTE,
      is_holding: master.is_holding,
      recorrencia_origem_id: master.id,
      is_recorrente: true,
      dia_vencimento_base: diaOriginal,
      criado_por: criadoPor || null,
      ...overrides,
    };

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

    const projecoes: DespesaOperacional[] = [];

    for (const rec of recorrentes) {
      if (
        rec.ano_competencia > ano ||
        (rec.ano_competencia === ano && rec.mes_competencia > mes)
      ) {
        continue;
      }

      if (rec.mes_competencia === mes && rec.ano_competencia === ano) {
        continue;
      }

      const jaExisteNoMes = reais.some((r) => r.recorrencia_origem_id === rec.id);
      if (jaExisteNoMes) {
        continue;
      }

      const diaOriginal = rec.dia_vencimento_base || Number(rec.data_vencimento.split("-")[2]) || 10;
      const ultimoDiaDoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
      const diaVenc = Math.min(diaOriginal, ultimoDiaDoMes);
      const novoVencimento = `${ano}-${String(mes).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;

      projecoes.push({
        id: `prev_desp_${rec.id}_${mes}_${ano}`,
        empresa_id: rec.empresa_id,
        categoria: rec.categoria,
        descricao: rec.descricao,
        mes_competencia: mes,
        ano_competencia: ano,
        valor_previsto: rec.valor_previsto,
        valor_pago: 0,
        data_vencimento: novoVencimento,
        data_pagamento: null,
        status: STATUS_DESPESA.PENDENTE,
        is_holding: rec.is_holding,
        grupo_parcelamento_id: null,
        numero_parcela: null,
        total_parcelas: null,
        is_recorrente: true,
        recorrencia_origem_id: rec.id,
        dia_vencimento_base: diaOriginal,
        is_previsao: true,
        empresa: rec.empresa,
      });
    }

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
      const totalRepeticoes = data.quantidade_parcelas!;
      const grupoId = crypto.randomUUID();
      const diaOriginal = Number(data.data_vencimento.split("-")[2]) || 10;

      const despesasParaInserir = [];

      for (let i = 1; i <= totalRepeticoes; i++) {
        const offsetMes = i - 1;
        const novoMes = ((data.mes_competencia - 1 + offsetMes) % 12) + 1;
        const novoAno = data.ano_competencia + Math.floor((data.mes_competencia - 1 + offsetMes) / 12);
        const ultimoDiaDoMes = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate();
        const diaVenc = Math.min(diaOriginal, ultimoDiaDoMes);
        const novoVencimento = `${novoAno}-${String(novoMes).padStart(2, "0")}-${String(diaVenc).padStart(2, "0")}`;

        despesasParaInserir.push({
          empresa_id: data.empresa_id,
          categoria: data.categoria,
          descricao: data.descricao.trim(),
          mes_competencia: novoMes,
          ano_competencia: novoAno,
          valor_previsto: data.valor_previsto,
          valor_pago: i === 1 ? data.valor_pago : 0,
          data_vencimento: novoVencimento,
          data_pagamento: i === 1 ? data.data_pagamento : null,
          status: i === 1 ? data.status : STATUS_DESPESA.PENDENTE,
          is_holding: data.is_holding,
          grupo_parcelamento_id: grupoId,
          numero_parcela: i,
          total_parcelas: totalRepeticoes,
          is_recorrente: false,
          dia_vencimento_base: diaOriginal,
          criado_por: criadoPor || null,
        });
      }

      const insertedList = await despesaRepository.insertMany(despesasParaInserir);
      return insertedList[0];
    }

    if (isRecorrente) {
      const diaOriginal = Number(data.data_vencimento.split("-")[2]) || 10;
      return despesaRepository.insert({
        empresa_id: data.empresa_id,
        categoria: data.categoria,
        descricao: data.descricao,
        mes_competencia: data.mes_competencia,
        ano_competencia: data.ano_competencia,
        valor_previsto: data.valor_previsto,
        valor_pago: data.valor_pago,
        data_vencimento: data.data_vencimento,
        data_pagamento: data.data_pagamento,
        status: data.status,
        is_holding: data.is_holding,
        is_recorrente: true,
        dia_vencimento_base: diaOriginal,
        criado_por: criadoPor || null,
      });
    }

    return despesaRepository.insert({
      empresa_id: data.empresa_id,
      categoria: data.categoria,
      descricao: data.descricao,
      mes_competencia: data.mes_competencia,
      ano_competencia: data.ano_competencia,
      valor_previsto: data.valor_previsto,
      valor_pago: data.valor_pago,
      data_vencimento: data.data_vencimento,
      data_pagamento: data.data_pagamento,
      status: data.status,
      is_holding: data.is_holding,
      criado_por: criadoPor || null,
    });
  },

  async update(id: string, data: UpdateDespesaDTO): Promise<DespesaOperacional> {
    if (id.startsWith("prev_desp_")) {
      return this._materializarPrevisaoDespesa(id, data as Partial<DespesaOperacional>);
    }
    const exists = await despesaRepository.getById(id);
    if (!exists) throw new AppError("Despesa não encontrada", 404);
    return despesaRepository.update(id, data as Record<string, unknown>);
  },

  async delete(id: string): Promise<void> {
    if (id.startsWith("prev_desp_")) {
      await this._materializarPrevisaoDespesa(id, { status: "CANCELADO" });
      return;
    }
    const exists = await despesaRepository.getById(id);
    if (!exists) throw new AppError("Despesa não encontrada", 404);
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
    return despesaRepository.update(id, { status: STATUS_DESPESA.ADIADA });
  },
};
