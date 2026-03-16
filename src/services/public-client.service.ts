import { supabaseAdmin } from "../config/supabase.js";
import { PONTO_STATUS } from "../constants/ponto.enum.js";
import { getNowBR, toBRTime, toLocalDateString } from "../utils/utils.js";
import { configuracaoService } from "./configuracao.service.js";

// Helper para extrair HH e MM de string (ISO ou HH:mm)
function parseTime(timeStr: string): [number, number] {
    if (!timeStr) return [0, 0];
    if (timeStr.includes("T")) {
        const date = new Date(timeStr);
        const options: Intl.DateTimeFormatOptions = {
            timeZone: 'America/Sao_Paulo',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        };
        const formatter = new Intl.DateTimeFormat('pt-BR', options);
        const parts = formatter.format(date).split(':');
        return [Number(parts[0]), Number(parts[1])];
    } else if (timeStr.includes(":")) {
        const [h, m] = timeStr.split(":").map(Number);
        return [h, m];
    }
    return [0, 0];
}

// Helper para formatar retorno (mesmo padrão do ponto.service.ts)
function formatPoint(p: any) {
    if (!p) return p;
    const result = { ...p };
    if (result.entrada_hora) result.entrada_hora = toBRTime(result.entrada_hora);
    if (result.saida_hora) result.saida_hora = toBRTime(result.saida_hora);
    if (result.created_at) result.created_at = toBRTime(result.created_at);
    if (result.updated_at) result.updated_at = toBRTime(result.updated_at);
    if (result.pausas && Array.isArray(result.pausas)) {
        result.pausas = result.pausas.map((pa: any) => ({
            ...pa,
            inicio_hora: pa.inicio_hora ? toBRTime(pa.inicio_hora) : null,
            fim_hora: pa.fim_hora ? toBRTime(pa.fim_hora) : null,
        }));
    }
    return result;
}

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
            .eq("status", "ATIVO")
            .order("nome_completo", { ascending: true });

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
                
                // REVERSÃO: Só mostramos se estiver na escala (o mapeamento posterior cuida dos pontos fora da escala)
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

        // 4. Buscar configurações globais para o cálculo dinâmico
        const [limiteAmarelo] = await Promise.all([
            configuracaoService.getConfiguracao("tolerancia_amarelo_min").then(d => Number(d?.valor || 15))
        ]);

        const hoje = toLocalDateString();
        const isHoje = dataReferencia === hoje;
        const isFuturo = dataReferencia > hoje;
        let nowTotalMin = 0;
        if (isHoje) {
            const nowStr = getNowBR();
            const [h, m] = parseTime(nowStr);
            nowTotalMin = h * 60 + m;
        }

        // 5. Montar o "Left Join" baseado nos Links
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

                // Lógica de Aging para Ponto Aberto
                if (!ponto.saida_hora) {
                    const [hFim, mFim] = parseTime(link.hora_fim);
                    const [hIni, mIni] = parseTime(link.hora_inicio);
                    let fimMin = hFim * 60 + mFim;
                    const iniMin = hIni * 60 + mIni;

                    if (fimMin < iniMin) fimMin += 1440; // Ajuste noturno

                    const isOpenTooLong = (!isHoje && !isFuturo) || (isHoje && nowTotalMin > (fimMin + 240));

                    if (isOpenTooLong) {
                        ponto.status_saida = PONTO_STATUS.PENDENTE;
                    }
                }

                return formatPoint({ ...ponto, usuario: link.usuario, cliente: link.cliente });
            }

            // --- CÁLCULO DE STATUS VIVO PARA QUEM NÃO BATEU PONTO ---
            let statusEntradaMock = PONTO_STATUS.AUSENTE;
            let statusSaidaMock = PONTO_STATUS.AUSENTE;

            const [hBase, mBase] = parseTime(link.hora_inicio);
            const inicioMinBase = hBase * 60 + mBase;

            if (isFuturo) {
                statusEntradaMock = PONTO_STATUS.CINZA; // Aguardando
                statusSaidaMock = PONTO_STATUS.CINZA;
            } else if (isHoje) {
                const [hInicio, mInicio] = parseTime(link.hora_inicio);
                const [hFim, mFim] = parseTime(link.hora_fim);
                const inicioMin = hInicio * 60 + mInicio;
                let fimMin = hFim * 60 + mFim;

                // Lógica para turno noturno
                if (fimMin < inicioMin) {
                    fimMin += 1440;
                }

                if (nowTotalMin < inicioMin) {
                    statusEntradaMock = PONTO_STATUS.CINZA; // Aguardando
                } else if (nowTotalMin === inicioMin) {
                    statusEntradaMock = PONTO_STATUS.VERDE; // No Horário
                } else if (nowTotalMin > fimMin) {
                    statusEntradaMock = PONTO_STATUS.AUSENTE; // Terminou o dia sem entrada
                } else if (nowTotalMin <= inicioMin + limiteAmarelo) {
                    statusEntradaMock = PONTO_STATUS.AMARELO; // Atrasado
                } else {
                    statusEntradaMock = PONTO_STATUS.VERMELHO; // Atraso Crítico
                }
                
                statusSaidaMock = nowTotalMin > fimMin ? PONTO_STATUS.AUSENTE : PONTO_STATUS.CINZA;
            }

            // Mock de ausente/aguardando
            return formatPoint({
                id: `ausente-${link.id}`,
                usuario_id: link.colaborador_id,
                data_referencia: dataReferencia,
                usuario: {
                    id: link.usuario.id,
                    nome_completo: link.usuario.nome_completo
                },
                entrada_hora: null,
                saida_hora: null,
                status_entrada: statusEntradaMock,
                status_saida: statusSaidaMock,
                cliente_id: clienteId,
                cliente: link.cliente,
                colaborador_cliente_id: link.id,
                detalhes_calculo: {
                    entrada: { 
                        turno_base: link.hora_inicio, 
                        tolerancia: limiteAmarelo, 
                        diff_minutos: isHoje && nowTotalMin > inicioMinBase ? nowTotalMin - inicioMinBase : 0 
                    },
                    saida: { 
                        turno_base: link.hora_fim, 
                        tolerancia: 0, 
                        diff_minutos: 0 
                    }
                },
                ausente: true
            });
        });

        // 5. Adicionar pontos "sobrantes" que não bateram com links de turno (extra)
        const leftoverPontos = pontos?.filter(p => !usedPointIds.has(p.id.toString())) || [];
        leftoverPontos.forEach(p => {
            const user = users?.find(u => u.id === p.usuario_id);
            mappedResults.push(formatPoint({ 
                ...p, 
                usuario: user ? { id: user.id, nome_completo: user.nome_completo } : p.usuario 
            }));
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
            .order("data_referencia", { ascending: false });

        if (error) throw error;
        return data || [];
    }
};
