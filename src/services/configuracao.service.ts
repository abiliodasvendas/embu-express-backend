import { supabaseAdmin } from "../config/supabase.js";

export const configuracaoService = {
    async listConfiguracoes(): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("configuracoes_sistema")
            .select("*")
            .order("chave", { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async getConfiguracao(chave: string): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("configuracoes_sistema")
            .select("*")
            .eq("chave", chave)
            .single();
        if (error) throw error;
        return data;
    },

    async updateConfiguracao(chave: string, valor: string): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("configuracoes_sistema")
            .update({ valor, updated_at: new Date().toISOString() })
            .eq("chave", chave)
            .select()
            .single();
        if (error) throw error;
        return data;
    }
};
