import { supabaseAdmin } from "../config/supabase.js";

/**
 * Serviço para persistência de ausências marcadas manualmente.
 * Agora utiliza a tabela 'ausencias_manuais' no Supabase para garantir persistência após F5 ou restart do servidor.
 */
export const ManualAbsenceService = {
  async add(date: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("ausencias_manuais")
      .upsert({ 
        usuario_id: userId, 
        data_referencia: date 
      }, {
        onConflict: "usuario_id, data_referencia"
      });

    if (error) {
      console.error("Erro ao adicionar ausência manual:", error);
      throw error;
    }
  },

  async remove(date: string, userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("ausencias_manuais")
      .delete()
      .match({ 
        usuario_id: userId, 
        data_referencia: date 
      });

    if (error) {
      console.error("Erro ao remover ausência manual:", error);
      throw error;
    }
  },

  async list(date: string): Promise<string[]> {
    const { data, error } = await supabaseAdmin
      .from("ausencias_manuais")
      .select("usuario_id")
      .eq("data_referencia", date);

    if (error) {
      console.error("Erro ao listar ausências manuais:", error);
      return [];
    }

    return data.map(item => item.usuario_id);
  }
};

