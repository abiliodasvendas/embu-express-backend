import { supabaseAdmin } from "../config/supabase.js";

export const pontoService = {
    async registrarPonto(data: any): Promise<any> {
        const { data: inserted, error } = await supabaseAdmin
            .from("registros_ponto")
            .insert([data])
            .select()
            .single();
        if (error) throw error;
        return inserted;
    },

    async updatePonto(id: number, data: Partial<any>): Promise<any> {
        const { data: updated, error } = await supabaseAdmin
            .from("registros_ponto")
            .update(data)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return updated;
    },

    async getPonto(id: number): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("registros_ponto")
            .select("*, usuario:usuarios(*)")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    async listPontos(filtros?: any): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("registros_ponto")
            .select("*, usuario:usuarios(*)")
            .order("data_referencia", { ascending: false });
        if (error) throw error;
        return data || [];
    },
    
    async getPontoHoje(usuarioId: string): Promise<any> {
        const hoje = new Date().toISOString().split('T')[0];
        const { data, error } = await supabaseAdmin
            .from("registros_ponto")
            .select("*")
            .eq("usuario_id", usuarioId)
            .eq("data_referencia", hoje)
            .maybeSingle();
        if (error) throw error;
        return data;
    }
};
