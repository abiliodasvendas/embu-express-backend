import { messages } from "../constants/messages.js";
import { AppError } from "../errors/AppError.js";
import { cleanString, onlyNumbers } from "../utils/utils.js";
import { Empresa } from "../types/database.js";
import { empresaSchema, updateEmpresaSchema, listEmpresaSchema } from "../schemas/empresa.schema.js";
import { empresaRepository } from "../repositories/empresa.repository.js";
import { z } from "zod";

type CreateEmpresaDTO = z.infer<typeof empresaSchema>;
type UpdateEmpresaDTO = z.infer<typeof updateEmpresaSchema>;
type ListEmpresaDTO = z.infer<typeof listEmpresaSchema>;

export const empresaService = {
  async createEmpresa(data: CreateEmpresaDTO): Promise<Empresa> {
    if (!data.nome_fantasia) throw new AppError(messages.empresa.erro.nomeObrigatorio, 400);

    const empresaData = {
      ...data,
      nome_fantasia: cleanString(data.nome_fantasia),
      razao_social: data.razao_social ? cleanString(data.razao_social) : null,
      ativo: data.ativo ?? true,
      cnpj: data.cnpj ? onlyNumbers(data.cnpj) : null,
    };

    try {
      return await empresaRepository.insert(empresaData);
    } catch (error: any) {
      if (error?.code === "23505" && error?.message?.toLowerCase().includes("cnpj")) {
        throw new AppError(messages.empresa.erro.cnpjJaExiste, 409);
      }
      throw error;
    }
  },

  async updateEmpresa(id: number, data: UpdateEmpresaDTO): Promise<Empresa> {
    if (!id) throw new AppError(messages.empresa.erro.idObrigatorio, 400);

    const empresaData: Partial<Empresa> = { ...data };
    if (data.nome_fantasia) empresaData.nome_fantasia = cleanString(data.nome_fantasia);
    if (data.razao_social) empresaData.razao_social = cleanString(data.razao_social);
    if (data.cnpj) empresaData.cnpj = onlyNumbers(data.cnpj);

    try {
      return await empresaRepository.update(id, empresaData);
    } catch (error: any) {
      if (error?.code === "23505" && error?.message?.toLowerCase().includes("cnpj")) {
        throw new AppError(messages.empresa.erro.cnpjJaExiste, 409);
      }
      throw error;
    }
  },

  async deleteEmpresa(id: number): Promise<void> {
    if (!id) throw new AppError(messages.empresa.erro.idObrigatorio, 400);
    await empresaRepository.delete(id);
  },

  async getEmpresa(id: number): Promise<Empresa> {
    const empresa = await empresaRepository.findById(id);
    if (!empresa) throw new AppError(messages.empresa.erro.idObrigatorio, 404);
    return empresa;
  },

  async listEmpresas(filtros?: ListEmpresaDTO): Promise<Empresa[]> {
    return empresaRepository.list(filtros);
  },

  async toggleAtivo(id: number, novoStatus: boolean): Promise<boolean> {
    try {
      await empresaRepository.update(id, { ativo: novoStatus });
      return novoStatus;
    } catch {
      throw new AppError(
        messages.empresa.erro.falhaAtivarDesativar.replace("{acao}", novoStatus ? "ativar" : "desativar"),
        500
      );
    }
  },
};
