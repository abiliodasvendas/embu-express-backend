import { supabaseAdmin } from "../config/supabase.js";
import { Feriado } from "../types/database.js";

export const feriadoService = {
    async listFeriados(ano?: number) {
        let query = supabaseAdmin
            .from('feriados')
            .select('*')
            .order('data', { ascending: true });

        if (ano) {
            query = query
                .gte('data', `${ano}-01-01`)
                .lte('data', `${ano}-12-31`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },

    async createFeriado(data: string, descricao: string) {
        const { data: created, error } = await supabaseAdmin
            .from('feriados')
            .insert([{ data, descricao }])
            .select()
            .single();

        if (error) throw error;
        return created;
    },

    async deleteFeriado(id: number) {
        const { error } = await supabaseAdmin
            .from('feriados')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    async updateFeriado(id: number, data?: string, descricao?: string) {
        const updateData: Partial<Feriado> = {};
        if (data) updateData.data = data;
        if (descricao) updateData.descricao = descricao;

        const { data: updated, error } = await supabaseAdmin
            .from('feriados')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return updated;
    }
};
