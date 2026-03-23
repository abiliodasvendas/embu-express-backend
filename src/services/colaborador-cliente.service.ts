import { logger } from "../config/logger.js";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { AppError } from "../errors/AppError.js";
import { ColaboradorCliente } from "../types/database.js";

export const colaboradorClienteService = {
    /**
     * Cria ou Substitui os vínculos de um colaborador.
     * Como a regra é "Reescrever", podemos implementar uma estratégia de Sync:
     * Remove tudo e cria de novo, ou Atualiza inteligentes.
     * Pela simplicidade inicial pedida: Delete All + Insert All para o usuário.
     */
    async syncLinks(usuarioId: string, links: ColaboradorCliente[]): Promise<ColaboradorCliente[]> {
        if (!usuarioId) throw new AppError(messages.usuario.erro.idObrigatorio, 400);

        // 1. Remove vínculos anteriores (CASCADE delete no banco deve remover os horários)
        const { error: deleteError } = await supabaseAdmin
            .from("colaborador_clientes")
            .delete()
            .eq("colaborador_id", usuarioId);

        if (deleteError) throw deleteError;

        if (!links || links.length === 0) return [];

        const results: ColaboradorCliente[] = [];

        // Por simplicidade e para garantir o ID de cada vínculo antes de inserir os horários,
        // faremos a inserção um a um nesta fase de transição.
        for (const link of links) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { horarios, id: _, created_at: __, updated_at: ___, ...linkData } = link;
            
            const payload = {
                ...linkData,
                colaborador_id: usuarioId
            };

            const { data: insertedLink, error: insertLinkError } = await supabaseAdmin
                .from("colaborador_clientes")
                .insert(payload)
                .select("*, cliente:clientes(nome_fantasia), unidade:unidades_cliente(nome_unidade), empresa:empresas(nome_fantasia)")
                .single();

            if (insertLinkError) throw insertLinkError;

            if (horarios && horarios.length > 0) {
                const horariosToInsert = (horarios as any[]).map(h => ({
                    colaborador_cliente_id: (insertedLink as any).id,
                    dia_semana: h.dia_semana,
                    hora_inicio: h.hora_inicio,
                    hora_fim: h.hora_fim,
                    tolerancia_pausa_min: h.tolerancia_pausa_min || 0
                }));

                const { error: horariosError } = await supabaseAdmin
                    .from("colaborador_cliente_horarios")
                    .insert(horariosToInsert);

                if (horariosError) throw horariosError;
                (insertedLink as any).horarios = horarios;
            }

            results.push(insertedLink as unknown as ColaboradorCliente);
        }

        return results;
    },

    async listLinks(usuarioId: string): Promise<ColaboradorCliente[]> {
        const { data, error } = await supabaseAdmin
            .from("colaborador_clientes")
            .select("*, cliente:clientes(*), unidade:unidades_cliente(*), empresa:empresas(*), horarios:colaborador_cliente_horarios(*)")
            .eq("colaborador_id", usuarioId)
            .order("created_at", { ascending: true });

        if (error) throw error;
        return (data || []) as ColaboradorCliente[];
    },

    async getAllLinksByCliente(clienteId: number): Promise<ColaboradorCliente[]> {
        const { data, error } = await supabaseAdmin
            .from("colaborador_clientes")
            .select("*, colaborador:usuarios(*), unidade:unidades_cliente(*), horarios:colaborador_cliente_horarios(*)")
            .eq("cliente_id", clienteId)
            .order("nome_completo", { referencedTable: "usuarios", ascending: true });

        if (error) throw error;
        return (data || []) as ColaboradorCliente[];
    },

    async createLink(linkData: Partial<ColaboradorCliente>): Promise<ColaboradorCliente> {
        logger.info({ linkData }, "[colaboradorClienteService] Criando vínculo");
        const { id, created_at, updated_at, horarios, ...rest } = linkData;
        const { data, error } = await supabaseAdmin
            .from("colaborador_clientes")
            .insert(rest)
            .select()
            .single();

        if (error) {
            logger.error({ error, rest }, "[colaboradorClienteService] Erro ao inserir na tabela colaborador_clientes");
            throw error;
        }

        if (horarios && horarios.length > 0) {
            const horariosToInsert = horarios.map(h => ({
                colaborador_cliente_id: data.id,
                dia_semana: h.dia_semana,
                hora_inicio: h.hora_inicio,
                hora_fim: h.hora_fim,
                tolerancia_pausa_min: h.tolerancia_pausa_min || 0
            }));
            const { error: hError } = await supabaseAdmin.from("colaborador_cliente_horarios").insert(horariosToInsert);
            if (hError) {
                logger.error({ error: hError, horariosToInsert }, "[colaboradorClienteService] Erro ao inserir horários");
                throw hError;
            }
            data.horarios = horarios;
        }

        logger.info({ id: data.id }, "[colaboradorClienteService] Vínculo criado com sucesso");
        return data as ColaboradorCliente;
    },

    async updateLink(id: number, linkData: Partial<ColaboradorCliente>): Promise<ColaboradorCliente> {
        logger.info({ id, linkData }, "[colaboradorClienteService] Atualizando vínculo");
        const { id: _, created_at, updated_at, horarios, ...rest } = linkData;
        
        const { data, error } = await supabaseAdmin
            .from("colaborador_clientes")
            .update(rest)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            logger.error({ error, id, rest }, "[colaboradorClienteService] Erro ao atualizar na tabela colaborador_clientes");
            throw error;
        }

        if (horarios) {
            // Remove antigos e insere novos para simplificar o sync dos horários do dia
            await supabaseAdmin.from("colaborador_cliente_horarios").delete().eq("colaborador_cliente_id", id);
            
            if (horarios.length > 0) {
                const horariosToInsert = horarios.map(h => ({
                    colaborador_cliente_id: id,
                    dia_semana: h.dia_semana,
                    hora_inicio: h.hora_inicio,
                    hora_fim: h.hora_fim,
                    tolerancia_pausa_min: h.tolerancia_pausa_min || 0
                }));
                const { error: hError } = await supabaseAdmin.from("colaborador_cliente_horarios").insert(horariosToInsert);
                if (hError) {
                    logger.error({ error: hError, id, horariosToInsert }, "[colaboradorClienteService] Erro ao atualizar horários");
                    throw hError;
                }
            }
            data.horarios = horarios;
        }

        logger.info({ id }, "[colaboradorClienteService] Vínculo atualizado com sucesso");
        return data as ColaboradorCliente;
    },

    async deleteLink(id: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("colaborador_clientes")
            .delete()
            .eq("id", id);

        if (error) throw error;
    }
};
