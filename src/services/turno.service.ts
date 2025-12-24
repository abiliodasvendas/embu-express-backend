import { supabaseAdmin } from "../config/supabase.js";

export const turnoService = {
    async listTurnosByUsuario(usuarioId: string): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("usuario_turnos")
            .select("*")
            .eq("usuario_id", usuarioId)
            .order("hora_inicio", { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async createTurno(data: any): Promise<any> {
        const { data: inserted, error } = await supabaseAdmin
            .from("usuario_turnos")
            .insert([data])
            .select()
            .single();
        if (error) throw error;
        return inserted;
    },

    async deleteTurno(id: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("usuario_turnos")
            .delete()
            .eq("id", id);
        if (error) throw error;
    }
};
