import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { cleanString } from "../utils/utils.js";
import { FilterOptions } from "../constants/filters.enum.js";
import { AppError } from "../errors/AppError.js";
import { clientSchema, updateClientSchema, listClientSchema } from "../schemas/client.schema.js";
import { z } from "zod";
import { Client } from "../types/database.js";

type CreateClientDTO = z.infer<typeof clientSchema>;
type UpdateClientDTO = z.infer<typeof updateClientSchema>;
type ListClientDTO = z.infer<typeof listClientSchema>;

export const clientService = {
  async createClient(data: CreateClientDTO): Promise<Client> {
    if (!data.nome_fantasia) throw new AppError(messages.cliente.erro.nomeObrigatorio, 400);

    const clientData = {
      nome_fantasia: cleanString(data.nome_fantasia),
      ativo: data.ativo ?? true,
    };

    const { data: inserted, error } = await supabaseAdmin
      .from("clientes")
      .insert([clientData])
      .select()
      .single();

    if (error) {
      if (error.code === "23505" && error.message?.toLowerCase().includes("cnpj")) {
        throw new AppError(messages.cliente.erro.cnpjJaExiste, 409);
      }
      throw error;
    }

    return inserted;
  },

  async updateClient(id: number, data: UpdateClientDTO): Promise<Client> {
    if (!id) throw new AppError(messages.cliente.erro.idObrigatorio, 400);

    const clientData: Partial<Client> = {};
    if (data.nome_fantasia) clientData.nome_fantasia = cleanString(data.nome_fantasia);
    if (data.ativo !== undefined) clientData.ativo = data.ativo;

    const { data: updated, error } = await supabaseAdmin
      .from("clientes")
      .update(clientData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505" && error.message?.toLowerCase().includes("cnpj")) {
        throw new AppError(messages.cliente.erro.cnpjJaExiste, 409);
      }
      throw error;
    }

    return updated as Client;
  },

  async deleteClient(id: number): Promise<void> {
    if (!id) throw new AppError(messages.cliente.erro.idObrigatorio, 400);

    const { error } = await supabaseAdmin.from("clientes").delete().eq("id", id);
    if (error) throw error;
  },

  async getClient(id: number): Promise<Client & { unidades: unknown[]; valor_total_contrato: number }> {
    const { data, error } = await supabaseAdmin
      .from("clientes")
      .select("*, unidades:unidades_cliente(*)")
      .eq("id", id)
      .single();
    if (error) throw error;

    const unidades = (data.unidades || []) as Array<{ ativo: boolean; valor_contrato_mensal?: number }>;
    const valorTotal = unidades
      .filter((u) => u.ativo)
      .reduce((acc, u) => acc + Number(u.valor_contrato_mensal || 0), 0);

    return {
      ...(data as Client),
      unidades: data.unidades,
      valor_total_contrato: parseFloat(valorTotal.toFixed(2)),
    };
  },

  async listClients(filtros?: ListClientDTO): Promise<Array<Client & { valor_total_contrato: number }>> {
    let query = supabaseAdmin
      .from("clientes")
      .select("*, unidades:unidades_cliente(id, valor_contrato_mensal, ativo)")
      .order("nome_fantasia", { ascending: true });

    if (filtros?.searchTerm) {
      const orClause = `nome_fantasia.ilike.%${filtros.searchTerm}%`;
      query = query.or(orClause);
    }

    if (filtros?.ativo !== undefined && filtros.ativo !== FilterOptions.TODOS) {
      if (filtros.includeId) {
        query = query.or(`ativo.eq.${filtros.ativo === "true"},id.eq.${filtros.includeId}`);
      } else {
        query = query.eq("ativo", filtros.ativo === "true");
      }
    } else if (filtros?.includeId) {
      query = query.eq("id", filtros.includeId);
    }

    const { data, error } = await query;
    if (error) throw error;

    type RawClient = Client & {
      unidades?: Array<{ id: number; valor_contrato_mensal?: number; ativo: boolean }>;
    };

    return ((data || []) as RawClient[]).map((c) => {
      const unidades = c.unidades || [];
      const valorTotal = unidades
        .filter((u) => u.ativo)
        .reduce((acc, u) => acc + Number(u.valor_contrato_mensal || 0), 0);

      return {
        id: c.id,
        public_id: c.public_id,
        nome_fantasia: c.nome_fantasia,
        ativo: c.ativo,
        latitude: c.latitude,
        longitude: c.longitude,
        created_at: c.created_at,
        updated_at: c.updated_at,
        valor_total_contrato: parseFloat(valorTotal.toFixed(2)),
      };
    });
  },

  async toggleAtivo(id: number, novoStatus: boolean): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from("clientes")
      .update({ ativo: novoStatus })
      .eq("id", id);

    if (error) {
      throw new AppError(
        messages.cliente.erro.falhaAtivarDesativar.replace("{acao}", novoStatus ? "ativar" : "desativar"),
        500
      );
    }
    return novoStatus;
  },
};
