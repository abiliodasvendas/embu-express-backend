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
            // .single() is dangerous if duplicates exist
            .limit(1); // Force single result at DB level
            
        if (error) throw error;
        return data?.[0]; // Return first item or undefined
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
