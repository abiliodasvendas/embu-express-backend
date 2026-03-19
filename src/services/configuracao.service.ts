import { supabaseAdmin } from "../config/supabase.js";
import { getNowBR } from "../utils/utils.js";

export interface Configuracao {
    chave: string;
    valor: string;
    descricao?: string;
    updated_at?: string;
}

export const configuracaoService = {
    async listConfiguracoes(): Promise<Configuracao[]> {
        const { data, error } = await supabaseAdmin
            .from("configuracoes_sistema")
            .select("*")
            .order("chave", { ascending: true });
        if (error) throw error;
        return (data || []) as Configuracao[];
    },

    async getConfiguracao(chave: string): Promise<Configuracao | undefined> {
        const { data, error } = await supabaseAdmin
            .from("configuracoes_sistema")
            .select("*")
            .eq("chave", chave)
            .limit(1);
            
        if (error) throw error;
        return data?.[0] as Configuracao | undefined;
    },

    async updateConfiguracao(chave: string, valor: string): Promise<Configuracao | undefined> {
        const { data, error } = await supabaseAdmin
            .from("configuracoes_sistema")
            .update({ valor, updated_at: getNowBR() })
            .eq("chave", chave)
            .select()
            .limit(1);
        if (error) throw error;
        return data?.[0] as Configuracao | undefined;
    }
};
