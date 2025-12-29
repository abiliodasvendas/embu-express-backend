import { supabaseAdmin } from "../config/supabase.js";
import { cleanString } from "../utils/utils.js";

export const clientService = {
    async createClient(data: any): Promise<any> {
        if (!data.nome_fantasia) throw new Error("Nome fantasia é obrigatório");

        const clientData: any = {
            ...data,
            nome_fantasia: cleanString(data.nome_fantasia),
            razao_social: data.razao_social ? cleanString(data.razao_social) : null,
            ativo: data.ativo !== undefined ? data.ativo : true,
            cnpj: data.cnpj ? data.cnpj.replace(/\D/g, "") : null,
            cep: data.cep ? data.cep.replace(/\D/g, "") : null,
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
        if (data.cnpj) clientData.cnpj = data.cnpj.replace(/\D/g, "");
        if (data.cep) clientData.cep = data.cep.replace(/\D/g, "");

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
        searchTerm?: string;
        ativo?: string;
        includeId?: string;
    }): Promise<any[]> {
        let query = supabaseAdmin
            .from("clientes")
            .select("*")
            .order("nome_fantasia", { ascending: true });

        if (filtros?.searchTerm) {
            const cleanSearch = filtros.searchTerm.replace(/\D/g, "");
            let orClause = `nome_fantasia.ilike.%${filtros.searchTerm}%,razao_social.ilike.%${filtros.searchTerm}%`;

            if (cleanSearch) {
                orClause += `,cnpj.ilike.%${cleanSearch}%`;
            }

            query = query.or(orClause);
        }

        if (filtros?.ativo !== undefined && filtros.ativo !== "todos") {
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

        return data || [];
    },
    async toggleAtivo(id: number, novoStatus: boolean): Promise<boolean> {
        const { error } = await supabaseAdmin
            .from("clientes")
            .update({ ativo: novoStatus })
            .eq("id", id);

        if (error) throw new Error(`Falha ao ${novoStatus ? "ativar" : "desativar"} o cliente.`);
        return novoStatus;
    },
};
