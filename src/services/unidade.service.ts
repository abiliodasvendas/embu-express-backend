import { z } from "zod";
import axios from "axios";
import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../errors/AppError.js";
import { unidadeSchema, updateUnidadeSchema } from "../schemas/unidade.schema.js";
import { Unidade } from "../types/database.js";
import { cleanString, onlyNumbers } from "../utils/utils.js";

type CreateUnidadeDTO = z.infer<typeof unidadeSchema>;
type UpdateUnidadeDTO = z.infer<typeof updateUnidadeSchema>;

export const unidadeService = {
  async geocodeAddress(enderecoParts: { logradouro?: string, numero?: string, cidade?: string, estado?: string }): Promise<{lat: number, lon: number} | null> {
    const partes = [];
    if (enderecoParts.logradouro) partes.push(enderecoParts.logradouro);
    if (enderecoParts.numero) partes.push(enderecoParts.numero);
    if (enderecoParts.cidade) partes.push(enderecoParts.cidade);
    if (enderecoParts.estado) partes.push(enderecoParts.estado);
    
    if (partes.length === 0) return null;
    
    const endereco = partes.join(', ');
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.error("GOOGLE_MAPS_API_KEY não configurada nas variáveis de ambiente.");
      return null;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(endereco)}&key=${apiKey}`;
      const response = await axios.get(url);
      
      if (response.data && response.data.status === "OK" && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        return {
          lat: location.lat,
          lon: location.lng
        };
      }
      return null;
    } catch (error) {
      console.error("Erro no geocoding do Google:", error);
      return null;
    }
  },

  async createUnidade(data: CreateUnidadeDTO): Promise<Unidade> {
    const coords = await this.geocodeAddress({
      logradouro: data.logradouro,
      numero: data.numero,
      cidade: data.cidade,
      estado: data.estado
    });

    if (!coords) {
      throw new AppError("Não foi possível encontrar as coordenadas geográficas para o endereço informado. Verifique se os dados estão corretos.", 400);
    }

    const payload = {
      ...data,
      nome_unidade: cleanString(data.nome_unidade),
      razao_social: cleanString(data.razao_social),
      cnpj: onlyNumbers(data.cnpj),
      cep: onlyNumbers(data.cep),
      latitude: coords.lat,
      longitude: coords.lon
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("unidades_cliente")
      .insert([payload])
      .select()
      .single();

    if (error) {
      if (error.code === '23505' && error.message?.toLowerCase().includes('cnpj')) {
        throw new AppError("CNPJ já cadastrado para outra unidade.", 409);
      }
      throw error;
    }

    return inserted;
  },

  async updateUnidade(id: number, data: UpdateUnidadeDTO): Promise<Unidade> {
    const { data: existing, error: fetchError } = await supabaseAdmin.from("unidades_cliente").select("*").eq("id", id).single();
    if (fetchError || !existing) throw new AppError("Unidade não encontrada.", 404);

    const addressChanged = 
      (data.logradouro !== undefined && data.logradouro !== existing.logradouro) ||
      (data.numero !== undefined && data.numero !== existing.numero) ||
      (data.cidade !== undefined && data.cidade !== existing.cidade) ||
      (data.estado !== undefined && data.estado !== existing.estado);

    const payload: any = { ...data };
    if (data.nome_unidade) payload.nome_unidade = cleanString(data.nome_unidade);
    if (data.razao_social) payload.razao_social = cleanString(data.razao_social);
    if (data.cnpj) payload.cnpj = onlyNumbers(data.cnpj);
    if (data.cep) payload.cep = onlyNumbers(data.cep);

    if (addressChanged) {
        const coords = await this.geocodeAddress({
          logradouro: payload.logradouro ?? existing.logradouro,
          numero: payload.numero ?? existing.numero,
          cidade: payload.cidade ?? existing.cidade,
          estado: payload.estado ?? existing.estado
        });

        if (!coords) {
          throw new AppError("Não foi possível localizar as coordenadas geográficas para este novo endereço. A atualização foi bloqueada.", 400);
        }
        payload.latitude = coords.lat;
        payload.longitude = coords.lon;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("unidades_cliente")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' && error.message?.toLowerCase().includes('cnpj')) {
        throw new AppError("CNPJ já cadastrado para outra unidade.", 409);
      }
      throw error;
    }

    return updated;
  },

  async deleteUnidade(id: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from("unidades_cliente")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async getUnidade(id: number): Promise<Unidade> {
    const { data, error } = await supabaseAdmin
      .from("unidades_cliente")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async listUnidadesByCliente(clienteId: number): Promise<Unidade[]> {
    const { data, error } = await supabaseAdmin
      .from("unidades_cliente")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("nome_unidade", { ascending: true });
    if (error) throw error;
    return data || [];
  }
};
