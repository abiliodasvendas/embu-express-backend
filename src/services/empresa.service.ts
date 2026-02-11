import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { cleanString } from "../utils/utils.js";

export const empresaService = {
    async createEmpresa(data: any): Promise<any> {
        if (!data.nome_fantasia) throw new Error(messages.empresa.erro.nomeObrigatorio);

        const empresaData: any = {
            ...data,
            nome_fantasia: cleanString(data.nome_fantasia),
            razao_social: data.razao_social ? cleanString(data.razao_social) : null,
            codigo: data.codigo ? data.codigo.trim().toUpperCase() : null,
            ativo: data.ativo !== undefined ? data.ativo : true,
            cnpj: data.cnpj ? data.cnpj.replace(/\D/g, "") : null,
        };

        const { data: inserted, error } = await supabaseAdmin
            .from("empresas")
            .insert([empresaData])
            .select()
            .single();
        if (error) throw error;

        return inserted;
    },

    async updateEmpresa(id: number, data: Partial<any>): Promise<any> {
        if (!id) throw new Error(messages.empresa.erro.idObrigatorio);

        const empresaData: any = { ...data };
        if (data.nome_fantasia) empresaData.nome_fantasia = cleanString(data.nome_fantasia);
        if (data.razao_social) empresaData.razao_social = cleanString(data.razao_social);
        if (data.codigo) empresaData.codigo = data.codigo.trim().toUpperCase();
        if (data.cnpj) empresaData.cnpj = data.cnpj.replace(/\D/g, "");

        const { data: updated, error } = await supabaseAdmin
            .from("empresas")
            .update(empresaData)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;

        return updated;
    },

    async deleteEmpresa(id: number): Promise<void> {
        if (!id) throw new Error(messages.empresa.erro.idObrigatorio);

        const { error } = await supabaseAdmin.from("empresas").delete().eq("id", id);
        if (error) throw error;
    },

    async getEmpresa(id: number): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("empresas")
            .select("*")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    async listEmpresas(filtros?: {
        searchTerm?: string;
        ativo?: string;
        includeId?: string;
    }): Promise<any[]> {
        let query = supabaseAdmin
            .from("empresas")
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
            .from("empresas")
            .update({ ativo: novoStatus })
            .eq("id", id);

        if (error) throw new Error(messages.empresa.erro.falhaAtivarDesativar.replace("{acao}", novoStatus ? "ativar" : "desativar"));
        return novoStatus;
    },
};
