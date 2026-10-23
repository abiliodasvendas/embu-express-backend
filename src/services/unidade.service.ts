import { z } from "zod";
import axios from "axios";
import { AppError } from "../errors/AppError.js";
import { unidadeSchema, updateUnidadeSchema } from "../schemas/unidade.schema.js";
import { Unidade } from "../types/database.js";
import { cleanString, onlyNumbers } from "../utils/utils.js";
import { unidadeRepository } from "../repositories/unidade.repository.js";

type CreateUnidadeDTO = z.infer<typeof unidadeSchema>;
type UpdateUnidadeDTO = z.infer<typeof updateUnidadeSchema>;

export const unidadeService = {
  async geocodeAddress(enderecoParts: {
    logradouro?: string;
    numero?: string;
    cidade?: string;
    estado?: string;
  }): Promise<{ lat: number; lon: number } | null> {
    const partes: string[] = [];
    if (enderecoParts.logradouro) partes.push(enderecoParts.logradouro);
    if (enderecoParts.numero) partes.push(enderecoParts.numero);
    if (enderecoParts.cidade) partes.push(enderecoParts.cidade);
    if (enderecoParts.estado) partes.push(enderecoParts.estado);

    if (partes.length === 0) return null;

    const endereco = partes.join(", ");
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return null;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        endereco
      )}&key=${apiKey}`;
      const response = await axios.get(url);

      if (response.data && response.data.status === "OK" && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return {
          lat: location.lat,
          lon: location.lng,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  async createUnidade(data: CreateUnidadeDTO): Promise<Unidade> {
    const coords = await this.geocodeAddress({
      logradouro: data.logradouro,
      numero: data.numero,
      cidade: data.cidade,
      estado: data.estado,
    });

    if (!coords) {
      throw new AppError(
        "Não foi possível localizar as coordenadas geográficas para este endereço. O cadastro da unidade foi bloqueado.",
        400
      );
    }

    const payload: Partial<Unidade> = {
      ...data,
      nome_unidade: cleanString(data.nome_unidade),
      razao_social: cleanString(data.razao_social),
      cnpj: onlyNumbers(data.cnpj),
      cep: onlyNumbers(data.cep),
      latitude: coords.lat,
      longitude: coords.lon,
    };

    try {
      return await unidadeRepository.insert(payload);
    } catch (error: any) {
      if (error?.code === "23505" && error?.message?.toLowerCase().includes("cnpj")) {
        throw new AppError("CNPJ já cadastrado para outra unidade.", 409);
      }
      throw error;
    }
  },

  async updateUnidade(id: number, data: UpdateUnidadeDTO): Promise<Unidade> {
    const existing = await unidadeRepository.findById(id);
    if (!existing) throw new AppError("Unidade não encontrada.", 404);

    const addressChanged =
      (data.logradouro !== undefined && data.logradouro !== existing.logradouro) ||
      (data.numero !== undefined && data.numero !== existing.numero) ||
      (data.cidade !== undefined && data.cidade !== existing.cidade) ||
      (data.estado !== undefined && data.estado !== existing.estado);

    const payload: Partial<Unidade> = { ...data };
    if (data.nome_unidade) payload.nome_unidade = cleanString(data.nome_unidade);
    if (data.razao_social) payload.razao_social = cleanString(data.razao_social);
    if (data.cnpj) payload.cnpj = onlyNumbers(data.cnpj);
    if (data.cep) payload.cep = onlyNumbers(data.cep);

    if (addressChanged) {
      const coords = await this.geocodeAddress({
        logradouro: payload.logradouro ?? existing.logradouro,
        numero: payload.numero ?? existing.numero,
        cidade: payload.cidade ?? existing.cidade,
        estado: payload.estado ?? existing.estado,
      });

      if (!coords) {
        throw new AppError(
          "Não foi possível localizar as coordenadas geográficas para este novo endereço. A atualização foi bloqueada.",
          400
        );
      }
      payload.latitude = coords.lat;
      payload.longitude = coords.lon;
    }

    try {
      return await unidadeRepository.update(id, payload);
    } catch (error: any) {
      if (error?.code === "23505" && error?.message?.toLowerCase().includes("cnpj")) {
        throw new AppError("CNPJ já cadastrado para outra unidade.", 409);
      }
      throw error;
    }
  },

  async deleteUnidade(id: number): Promise<void> {
    await unidadeRepository.delete(id);
  },

  async getUnidade(id: number): Promise<Unidade> {
    const unidade = await unidadeRepository.findById(id);
    if (!unidade) throw new AppError("Unidade não encontrada.", 404);
    return unidade;
  },

  async listUnidadesByCliente(clienteId: number): Promise<Unidade[]> {
    return unidadeRepository.listByCliente(clienteId);
  },
};
