import { AppError } from "../errors/AppError.js";
import { MovimentacaoAvulsa, TipoMovimentacaoAvulsa, CategoriaMovimentacaoAvulsa } from "../types/database.js";
import { z } from "zod";
import { movimentacaoAvulsaSchema, updateMovimentacaoAvulsaSchema } from "../schemas/movimentacoes-avulsas.schema.js";
import { movimentacaoAvulsaRepository, ListMovimentacoesFilters } from "../repositories/movimentacao-avulsa.repository.js";

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

  async update(id: string, data: UpdateMovimentacaoDTO): Promise<MovimentacaoAvulsa> {
    const exists = await movimentacaoAvulsaRepository.getById(id);
    if (!exists) throw new AppError("Movimentação avulsa não encontrada", 404);

    const payload: Record<string, unknown> = { ...data };
    if (data.data_movimentacao) {
      payload.mes_competencia = parseInt(data.data_movimentacao.split("-")[1], 10);
      payload.ano_competencia = parseInt(data.data_movimentacao.split("-")[0], 10);
    }

    return movimentacaoAvulsaRepository.update(id, payload);
  },

  async delete(id: string): Promise<void> {
    const exists = await movimentacaoAvulsaRepository.getById(id);
    if (!exists) throw new AppError("Movimentação avulsa não encontrada", 404);
    await movimentacaoAvulsaRepository.delete(id);
  },
};
