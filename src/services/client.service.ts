import { supabaseAdmin } from "../config/supabase.js";
import { cleanString } from "../utils/utils.js";

export const clientService = {
    async createClient(data: any): Promise<any> {
        if (!data.nome_fantasia) throw new Error("Nome fantasia é obrigatório");

        const clientData: any = {
            ...data,
            nome_fantasia: cleanString(data.nome_fantasia),
            razao_social: data.razao_social ? cleanString(data.razao_social) : null,
            status: data.status || "ativo",
        };

        const { data: inserted, error } = await supabaseAdmin
            .from("clientes")
            .insert([clientData])
            .select()
            .single();
        if (error) throw error;

        return inserted;
    },

    async updateClient(id: number, data: Partial<any>): Promise<any> {
        if (!id) throw new Error("ID do cliente é obrigatório");

        const clientData: any = { ...data };
        if (data.nome_fantasia) clientData.nome_fantasia = cleanString(data.nome_fantasia);
        if (data.razao_social) clientData.razao_social = cleanString(data.razao_social);

        const { data: updated, error } = await supabaseAdmin
            .from("clientes")
            .update(clientData)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;

        return updated;
    },

    async deleteClient(id: number): Promise<void> {
        if (!id) throw new Error("ID do cliente é obrigatório");

        const { error } = await supabaseAdmin.from("clientes").delete().eq("id", id);
        if (error) throw error;
    },

    async getClient(id: number): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("clientes")
            .select("*")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    async listClients(filtros?: {
        search?: string;
        status?: string;
    }): Promise<any[]> {
        let query = supabaseAdmin
            .from("clientes")
            .select("*")
            .order("nome_fantasia", { ascending: true });

        if (filtros?.search) {
            query = query.or(
                `nome_fantasia.ilike.%${filtros.search}%,razao_social.ilike.%${filtros.search}%,cnpj.ilike.%${filtros.search}%`
            );
        }

        if (filtros?.status && filtros.status !== "todos") {
            query = query.eq("status", filtros.status);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
    },
};
