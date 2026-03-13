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
        // 1. Buscar todos os usuários ativos vinculados a este cliente
        const { data: users, error: userError } = await supabaseAdmin
            .from("usuarios")
            .select(`
                *,
                perfil:perfis(*),
                links:colaborador_clientes!inner(
                    *, 
                    cliente:clientes(*)
                )
            `)
            .eq("status", "ATIVO")
            .eq("links.cliente_id", clienteId);

        if (userError) throw userError;

        // Determinar o dia da semana para o filtro de escala (1=Seg, ..., 7=Dom)
        const dateObj = new Date(dataReferencia + "T12:00:00Z");
        let dayOfWeek = dateObj.getUTCDay(); // 0=Dom
        const scaleDay = dayOfWeek === 0 ? 7 : dayOfWeek;

        // 2. Explodir os links em registros base
        const activeLinks: any[] = [];
        users?.forEach(u => {
            u.links?.forEach((link: any) => {
                const isVigente = !link.data_fim || link.data_fim >= dataReferencia;
                // Importante: No link, o cliente já vem populado pelo !inner join acima
                const naEscala = link.cliente?.escala_semanal?.includes(scaleDay);
                
                if (isVigente && naEscala) {
                    activeLinks.push({ ...link, usuario: u });
                }
            });
        });

        if (activeLinks.length === 0) return [];

        // 3. Buscar registros de ponto existentes para este cliente na data
        const { data: pontos, error: pontoError } = await supabaseAdmin
            .from("registros_ponto")
            .select(`
                *,
                pausas:registros_pausas(*)
            `)
            .eq("cliente_id", clienteId)
            .eq("data_referencia", dataReferencia);

        if (pontoError) throw pontoError;

        // 4. Montar o "Left Join" baseado nos Links (mesma lógica do ponto.service.ts)
        const usedPointIds = new Set<string>();
        const mappedResults = activeLinks.map(link => {
            const ponto = pontos?.find(p => 
                p.usuario_id === link.colaborador_id && 
                (
                    (p.colaborador_cliente_id && String(p.colaborador_cliente_id) === String(link.id)) ||
                    (!p.colaborador_cliente_id && p.detalhes_calculo?.entrada?.turno_base === link.hora_inicio)
                )
            );
            
            if (ponto) {
                usedPointIds.add(ponto.id.toString());
                return { ...ponto, usuario: link.usuario, cliente: link.cliente };
            }

            // Mock de ausente
            return {
                id: `ausente-${link.id}`,
                usuario_id: link.colaborador_id,
                data_referencia: dataReferencia,
                usuario: {
                    id: link.usuario.id,
                    nome_completo: link.usuario.nome_completo
                },
                entrada_hora: null,
                saida_hora: null,
                status_entrada: 'AUSENTE',
                status_saida: 'AUSENTE',
                cliente_id: clienteId,
                cliente: link.cliente,
                colaborador_cliente_id: link.id,
                detalhes_calculo: {
                    entrada: { turno_base: link.hora_inicio, tolerancia: 15, diff_minutos: 0 },
                    saida: { turno_base: link.hora_fim, tolerancia: 10, diff_minutos: 0 }
                },
                ausente: true
            };
        });

        // 5. Adicionar pontos "sobrantes" que não bateram com links de turno
        const leftoverPontos = pontos?.filter(p => !usedPointIds.has(p.id.toString())) || [];
        leftoverPontos.forEach(p => {
            const user = users?.find(u => u.id === p.usuario_id);
            mappedResults.push({ 
                ...p, 
                usuario: user ? { id: user.id, nome_completo: user.nome_completo } : p.usuario 
            });
        });

        // Ordenar alfabeticamente
        return mappedResults.sort((a, b) => {
            const nomeA = a.usuario?.nome_completo?.toLowerCase() || "";
            const nomeB = b.usuario?.nome_completo?.toLowerCase() || "";
            return nomeA.localeCompare(nomeB);
        });
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
