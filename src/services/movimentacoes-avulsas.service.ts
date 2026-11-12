import { AppError } from "../errors/AppError.js";
import { MovimentacaoAvulsa } from "../types/database.js";
import { z } from "zod";
import {
  CreateTransferenciaContasDTO,
  movimentacaoAvulsaSchema,
  updateMovimentacaoAvulsaSchema,
} from "../schemas/movimentacoes-avulsas.schema.js";
import {
  movimentacaoAvulsaRepository,
  ListMovimentacoesFilters,
} from "../repositories/movimentacao-avulsa.repository.js";
import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";
import { CATEGORIA_MOVIMENTACAO_AVULSA, TIPO_MOVIMENTACAO_AVULSA } from "../constants/financeiro.enum.js";

type CreateMovimentacaoDTO = z.infer<typeof movimentacaoAvulsaSchema>;
type UpdateMovimentacaoDTO = z.infer<typeof updateMovimentacaoAvulsaSchema>;

export const movimentacoesAvulsasService = {
  async list(filtros: ListMovimentacoesFilters): Promise<MovimentacaoAvulsa[]> {
    return movimentacaoAvulsaRepository.list(filtros);
  },

  async getById(id: string): Promise<MovimentacaoAvulsa> {
    const data = await movimentacaoAvulsaRepository.getById(id);
    if (!data) throw new AppError("Movimentação avulsa não encontrada", 404);
    return data;
  },

  async create(data: CreateMovimentacaoDTO, criadoPor?: string): Promise<MovimentacaoAvulsa> {
    const mesCompetencia = parseInt(data.data_movimentacao.split("-")[1], 10);
    const anoCompetencia = parseInt(data.data_movimentacao.split("-")[0], 10);

    const record = {
      ...data,
      mes_competencia: mesCompetencia,
      ano_competencia: anoCompetencia,
      criado_por: criadoPor || null,
    };

    return movimentacaoAvulsaRepository.insert(record);
  },

  async createTransferencia(
    dto: CreateTransferenciaContasDTO,
    criadoPor?: string
  ): Promise<{ saida: MovimentacaoAvulsa; entrada: MovimentacaoAvulsa }> {
    if (dto.conta_origem_id === dto.conta_destino_id) {
      throw new AppError("A conta de origem e a conta de destino devem ser diferentes.", 400);
    }

    const [contaOrigem, contaDestino] = await Promise.all([
      contaBancariaRepository.getById(dto.conta_origem_id),
      contaBancariaRepository.getById(dto.conta_destino_id),
    ]);

    if (!contaOrigem) {
      throw new AppError("Conta bancária de origem não encontrada.", 404);
    }
    if (!contaDestino) {
      throw new AppError("Conta bancária de destino não encontrada.", 404);
    }

    const mesCompetencia = parseInt(dto.data_movimentacao.split("-")[1], 10);
    const anoCompetencia = parseInt(dto.data_movimentacao.split("-")[0], 10);

    const nomeOrigem = `${contaOrigem.banco_nome}${contaOrigem.conta ? ` (${contaOrigem.conta})` : ""}`;
    const nomeDestino = `${contaDestino.banco_nome}${contaDestino.conta ? ` (${contaDestino.conta})` : ""}`;
    const descBase = dto.descricao?.trim();

    const descricaoSaida = descBase
      ? `${descBase} — Para: ${nomeDestino}`
      : `Transferência enviada para ${nomeDestino}`;

    const descricaoEntrada = descBase
      ? `${descBase} — De: ${nomeOrigem}`
      : `Transferência recebida de ${nomeOrigem}`;

    const saidaCriada = await movimentacaoAvulsaRepository.insert({
      empresa_id: contaOrigem.empresa_id,
      conta_bancaria_id: contaOrigem.id,
      conta_contrapartida_id: contaDestino.id,
      tipo_movimentacao: TIPO_MOVIMENTACAO_AVULSA.SAIDA,
      categoria: CATEGORIA_MOVIMENTACAO_AVULSA.TRANSFERENCIA_ENTRE_CONTAS,
      descricao: descricaoSaida,
      valor: dto.valor,
      data_movimentacao: dto.data_movimentacao,
      mes_competencia: mesCompetencia,
      ano_competencia: anoCompetencia,
      criado_por: criadoPor || null,
    });

    const entradaCriada = await movimentacaoAvulsaRepository.insert({
      empresa_id: contaDestino.empresa_id,
      conta_bancaria_id: contaDestino.id,
      conta_contrapartida_id: contaOrigem.id,
      transferencia_par_id: saidaCriada.id,
      tipo_movimentacao: TIPO_MOVIMENTACAO_AVULSA.ENTRADA,
      categoria: CATEGORIA_MOVIMENTACAO_AVULSA.TRANSFERENCIA_ENTRE_CONTAS,
      descricao: descricaoEntrada,
      valor: dto.valor,
      data_movimentacao: dto.data_movimentacao,
      mes_competencia: mesCompetencia,
      ano_competencia: anoCompetencia,
      criado_por: criadoPor || null,
    });

    const saidaVinculada = await movimentacaoAvulsaRepository.update(saidaCriada.id, {
      transferencia_par_id: entradaCriada.id,
    });

    return {
      saida: saidaVinculada,
      entrada: entradaCriada,
    };
  },

  async update(id: string, data: UpdateMovimentacaoDTO): Promise<MovimentacaoAvulsa> {
    const exists = await movimentacaoAvulsaRepository.getById(id);
    if (!exists) throw new AppError("Movimentação avulsa não encontrada", 404);

    const payload: Record<string, unknown> = { ...data };
    if (data.data_movimentacao) {
      payload.mes_competencia = parseInt(data.data_movimentacao.split("-")[1], 10);
      payload.ano_competencia = parseInt(data.data_movimentacao.split("-")[0], 10);
    }

    const updated = await movimentacaoAvulsaRepository.update(id, payload);

    if (exists.transferencia_par_id && (data.valor !== undefined || data.data_movimentacao !== undefined)) {
      const parPayload: Record<string, unknown> = {};
      if (data.valor !== undefined) parPayload.valor = data.valor;
      if (data.data_movimentacao !== undefined) {
        parPayload.data_movimentacao = data.data_movimentacao;
        parPayload.mes_competencia = payload.mes_competencia;
        parPayload.ano_competencia = payload.ano_competencia;
      }
      await movimentacaoAvulsaRepository.update(exists.transferencia_par_id, parPayload);
    }

    return updated;
  },

  async delete(id: string): Promise<void> {
    const exists = await movimentacaoAvulsaRepository.getById(id);
    if (!exists) throw new AppError("Movimentação avulsa não encontrada", 404);

    if (exists.transferencia_par_id) {
      await movimentacaoAvulsaRepository.delete(exists.transferencia_par_id);
    }
    await movimentacaoAvulsaRepository.delete(id);
  },
};
