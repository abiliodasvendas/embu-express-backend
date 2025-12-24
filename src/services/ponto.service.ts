import { supabaseAdmin } from "../config/supabase.js";

export const pontoService = {
    async registrarPonto(data: any): Promise<any> {
        if (!data.usuario_id) throw new Error("Usuário é obrigatório");
        if (!data.data_referencia) throw new Error("Data de referência é obrigatória");

        const { data: inserted, error } = await supabaseAdmin
            .from("registros_ponto")
            .insert([data])
            .select()
            .single();
        if (error) throw error;

        return inserted;
    },

    async updatePonto(id: number, data: Partial<any>): Promise<any> {
        if (!id) throw new Error("ID do registro de ponto é obrigatório");

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

    async listPontos(filtros?: {
        usuario_id?: string;
        data_inicio?: string;
        data_fim?: string;
    }): Promise<any[]> {
        let query = supabaseAdmin
            .from("registros_ponto")
            .select("*, usuario:usuarios(*)")
            .order("data_referencia", { ascending: false });

        if (filtros?.usuario_id) query = query.eq("usuario_id", filtros.usuario_id);
        if (filtros?.data_inicio) query = query.gte("data_referencia", filtros.data_inicio);
        if (filtros?.data_fim) query = query.lte("data_referencia", filtros.data_fim);

        const { data, error } = await query;
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
