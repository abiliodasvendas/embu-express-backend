import { AppError } from "../errors/AppError.js";
import { ContaBancaria } from "../types/database.js";
import { z } from "zod";
import { contaBancariaSchema, updateContaBancariaSchema } from "../schemas/conta-bancaria.schema.js";
import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";

type CreateContaBancariaDTO = z.infer<typeof contaBancariaSchema>;
type UpdateContaBancariaDTO = z.infer<typeof updateContaBancariaSchema>;

export const contaBancariaService = {
  async list(empresaId?: number): Promise<ContaBancaria[]> {
    return contaBancariaRepository.list(empresaId);
  },

  async getById(id: string): Promise<ContaBancaria> {
    const data = await contaBancariaRepository.getById(id);
    if (!data) {
      throw new AppError("Conta bancária não encontrada", 404);
    }
    return data;
  },

  async create(data: CreateContaBancariaDTO): Promise<ContaBancaria> {
    return contaBancariaRepository.create(data);
  },

  async update(id: string, data: UpdateContaBancariaDTO): Promise<ContaBancaria> {
    const exists = await contaBancariaRepository.getById(id);
    if (!exists) {
      throw new AppError("Conta bancária não encontrada para atualização", 404);
    }
    return contaBancariaRepository.update(id, data);
  },

  async delete(id: string): Promise<void> {
    const exists = await contaBancariaRepository.getById(id);
    if (!exists) {
      throw new AppError("Conta bancária não encontrada para exclusão", 404);
    }
    await contaBancariaRepository.delete(id);
  },
};
