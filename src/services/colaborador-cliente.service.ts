import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";

export const colaboradorClienteService = {
    /**
     * Cria ou Substitui os vínculos de um colaborador.
     * Como a regra é "Reescrever", podemos implementar uma estratégia de Sync:
     * Remove tudo e cria de novo, ou Atualiza inteligentes.
     * Pela simplicidade inicial pedida: Delete All + Insert All para o usuário.
     */
    async syncLinks(usuarioId: string, links: any[]): Promise<any[]> {
        if (!usuarioId) throw new Error(messages.usuario.erro.idObrigatorio);
        
        // 1. Remove vínculos anteriores
        const { error: deleteError } = await supabaseAdmin
            .from("colaborador_clientes")
            .delete()
            .eq("colaborador_id", usuarioId);
            
        if (deleteError) throw deleteError;
        
        if (!links || links.length === 0) return [];

        // 2. Prepara novos vínculos
        const linksToInsert = links.map(link => ({
            colaborador_id: usuarioId,
            cliente_id: link.cliente_id,
            empresa_id: link.empresa_id,
            hora_inicio: link.hora_inicio,
            hora_fim: link.hora_fim,
            valor_contrato: link.valor_contrato,
            valor_aluguel: link.valor_aluguel,
            valor_bonus: link.valor_bonus,
            ajuda_custo: link.ajuda_custo,
            mei: link.mei
        }));
        
        // 3. Insere novos
        const { data: inserted, error: insertError } = await supabaseAdmin
            .from("colaborador_clientes")
            .insert(linksToInsert)
            .select("*, cliente:clientes(nome_fantasia), empresa:empresas(nome_fantasia)");
            
        if (insertError) throw insertError;
        
        return inserted || [];
    },

    async listLinks(usuarioId: string): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("colaborador_clientes")
            .select("*, cliente:clientes(*), empresa:empresas(*)")
            .eq("colaborador_id", usuarioId);
            
        if (error) throw error;
        return data || [];
    },

    async getAllLinksByCliente(clienteId: number): Promise<any[]> {
        const { data, error } = await supabaseAdmin
            .from("colaborador_clientes")
            .select("*, colaborador:usuarios(*)")
            .eq("cliente_id", clienteId);
            
        if (error) throw error;
        return data || [];
    },

    async createLink(linkData: any): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("colaborador_clientes")
            .insert(linkData)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async updateLink(id: number, linkData: any): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("colaborador_clientes")
            .update(linkData)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteLink(id: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("colaborador_clientes")
            .delete()
            .eq("id", id);

        if (error) throw error;
    }
};
