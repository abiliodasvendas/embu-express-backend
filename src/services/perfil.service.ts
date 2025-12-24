import { supabaseAdmin } from "../config/supabase.js";

export const perfilService = {
    async listPerfis(): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("perfis")
            .select("*")
            .order("nome", { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async getPerfil(id: number): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("perfis")
            .select("*")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },
};
