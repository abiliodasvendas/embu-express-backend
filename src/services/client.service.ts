import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { cleanString, onlyNumbers } from "../utils/utils.js";
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
            if (error.code === '23505' && error.message?.toLowerCase().includes('cnpj')) {
                throw new AppError(messages.cliente.erro.cnpjJaExiste, 409);
            }
            throw error;
        }

        return inserted;
    },

    async updateClient(id: number, data: UpdateClientDTO): Promise<Client> {
        if (!id) throw new AppError(messages.cliente.erro.idObrigatorio, 400);

        const clientData: Partial<Client> = { ...data } as Partial<Client>;
        if (data.nome_fantasia) clientData.nome_fantasia = cleanString(data.nome_fantasia);

        const { data: updated, error } = await supabaseAdmin
            .from("clientes")
            .update(clientData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505' && error.message?.toLowerCase().includes('cnpj')) {
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

    async getClient(id: number): Promise<Client> {
        const { data, error } = await supabaseAdmin
            .from("clientes")
            .select("*, unidades:unidades_cliente(*)")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data as Client & { unidades: any[] };
    },

    async listClients(filtros?: ListClientDTO): Promise<Client[]> {
        let query = supabaseAdmin
            .from("clientes")
            .select("*")
            .order("nome_fantasia", { ascending: true });

        if (filtros?.searchTerm) {
            let orClause = `nome_fantasia.ilike.%${filtros.searchTerm}%`;

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

        return (data || []) as Client[];
    },
    async toggleAtivo(id: number, novoStatus: boolean): Promise<boolean> {
        const { error } = await supabaseAdmin
            .from("clientes")
            .update({ ativo: novoStatus })
            .eq("id", id);

        if (error) throw new AppError(messages.cliente.erro.falhaAtivarDesativar.replace("{acao}", novoStatus ? "ativar" : "desativar"), 500);
        return novoStatus;
    },
};
