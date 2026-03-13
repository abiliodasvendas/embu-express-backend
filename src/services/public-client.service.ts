import { supabaseAdmin } from "../config/supabase.js";
import { toLocalDateString } from "../utils/utils.js";

export const publicClientService = {
    /**
     * Valida se um cliente existe e está ativo pelo public_id
     */
    async getClientByPublicId(publicId: string): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("clientes")
            .select("id, nome_fantasia, ativo")
            .eq("public_id", publicId)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error("Link inválido ou cliente não encontrado.");
        if (!data.ativo) throw new Error("A visualização está indisponível. Entre em contato com o administrativo.");

        return data;
    },

    /**
     * Lista colaboradores vinculados ao cliente
     */
    async listCollaborators(clienteId: number): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("usuarios")
            .select(`
                id, 
                nome_completo, 
                links:colaborador_clientes!inner(
                    id, 
                    hora_inicio, 
                    hora_fim, 
                    cliente_id
                )
            `)
            .eq("links.cliente_id", clienteId)
            .eq("status", "ATIVO");

        if (error) throw error;
        return data || [];
    },

    /**
     * Controle de Ponto Público (Scoped by client)
     */
    async getControlePonto(clienteId: number, dataReferencia: string): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("registros_ponto")
            .select(`
                *,
                usuario:usuarios!registros_ponto_usuario_id_fkey(id, nome_completo),
                pausas:registros_pausas(*),
                cliente:clientes(*)
            `)
            .eq("cliente_id", clienteId)
            .eq("data_referencia", dataReferencia)
            .order("entrada_hora", { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Espelho de Ponto Público (Scoped by client and user)
     */
    async getEspelhoPonto(clienteId: number, usuarioId: string, mes: number, ano: number): Promise<any[]> {
        const startOfMonth = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const lastDay = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const endOfMonth = `${ano}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data, error } = await supabaseAdmin
            .from("v_relatorio_mensal_ponto")
            .select("*")
            .eq("cliente_id", clienteId)
            .eq("usuario_id", usuarioId)
            .gte("data_referencia", startOfMonth)
            .lte("data_referencia", endOfMonth)
            .order("data_referencia", { ascending: true });

        if (error) throw error;
        return data || [];
    }
};
