import { supabaseAdmin } from "../config/supabase.js";
import { PONTO_STATUS } from "../constants/ponto.enum.js";
import { getNowBR, toBRTime, toLocalDateString, formatPoint } from "../utils/utils.js";
import { AppError } from "../errors/AppError.js";
import { configuracaoService } from "./configuracao.service.js";
import { parseTime } from "./ponto-calculator.service.js";
import { Client, ColaboradorCliente, RegistroPonto, Usuario, Pausa } from "../types/database.js";



export const publicClientService = {
    /**
     * Valida se um cliente existe e está ativo pelo public_id
     */
    async getClientByPublicId(publicId: string): Promise<Partial<Client>> {
        const { data, error } = await supabaseAdmin
            .from("clientes")
            .select("id, nome_fantasia, ativo")
            .eq("public_id", publicId)
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new AppError("Link inválido ou cliente não encontrado.", 404);
        if (!data.ativo) throw new AppError("A visualização está indisponível. Entre em contato com o administrativo.", 403);

        return data;
    },

    /**
     * Lista colaboradores vinculados ao cliente
     */
    async listCollaborators(clienteId: number): Promise<{
        id: string;
        nome_completo: string;
        links: {
            id: number;
            cliente_id: number;
            horarios?: { dia_semana: number; hora_inicio: string; hora_fim: string; }[];
        }[];
    }[]> {
        const { data, error } = await supabaseAdmin
            .from("usuarios")
            .select(`
                id, 
                nome_completo, 
                links:colaborador_clientes!inner(
                    id, 
                    cliente_id,
                    horarios:colaborador_cliente_horarios(
                        dia_semana,
                        hora_inicio,
                        hora_fim
                    )
                )
            `)
            .eq("links.cliente_id", clienteId)
            .eq("status", "ATIVO")
            .order("nome_completo", { ascending: true });

        if (error) throw error;
        return (data || []) as { id: string; nome_completo: string; links: { id: number; cliente_id: number; horarios?: { dia_semana: number; hora_inicio: string; hora_fim: string; }[] }[] }[];
    },

    /**
     * Controle de Ponto Público (Scoped by client)
     */
    async getControlePonto(clienteId: number, dataReferencia: string): Promise<RegistroPonto[]> {
        // 1. Buscar todos os usuários ativos vinculados a este cliente
        const { data: users, error: userError } = await supabaseAdmin
            .from("usuarios")
            .select(`
                *,
                perfil:perfis(*),
                links:colaborador_clientes!inner(
                    *, 
                    cliente:clientes(*),
                    horarios:colaborador_cliente_horarios(*)
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
        const activeLinks: (ColaboradorCliente & { usuario: Usuario })[] = [];
        users?.forEach((u) => {
            const userLinks = u.links as (ColaboradorCliente & { cliente: Client })[];
            userLinks?.forEach((link) => {
                const isVigente = !link.data_fim || link.data_fim >= dataReferencia;
                // O horário do dia no vínculo agora define a obrigação
                const hConfig = link.horarios?.find(h => h.dia_semana === scaleDay);
                const naEscala = !!hConfig;
                
                // REVERSÃO: Só mostramos se estiver na escala (o mapeamento posterior cuida dos pontos fora da escala)
                if (isVigente && naEscala) {
                    activeLinks.push({ ...link, usuario: u as unknown as Usuario });
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
        const mappedResults = activeLinks.map((link) => {
            const hConfig = link.horarios?.find(h => h.dia_semana === scaleDay);
            const hIniMock = hConfig?.hora_inicio || '00:00';
            const hFimMock = hConfig?.hora_fim || '00:00';

            const ponto = pontos?.find((p) => 
                p.usuario_id === link.colaborador_id && 
                (
                    (p.colaborador_cliente_id && String(p.colaborador_cliente_id) === String(link.id)) ||
                    (!p.colaborador_cliente_id && p.detalhes_calculo?.entrada?.turno_base === hIniMock)
                )
            );
            
            if (ponto) {
                usedPointIds.add(ponto.id.toString());

                // Lógica de Aging para Ponto Aberto
                if (!ponto.saida_hora) {
                    const [hFim, mFim] = parseTime(hFimMock);
                    const [hIni, mIni] = parseTime(hIniMock);
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

            const [hBase, mBase] = parseTime(hIniMock);
            const inicioMinBase = hBase * 60 + mBase;

            if (isFuturo) {
                statusEntradaMock = PONTO_STATUS.CINZA; // Aguardando
                statusSaidaMock = PONTO_STATUS.CINZA;
            } else if (isHoje) {
                const [hInicio, mInicio] = parseTime(hIniMock);
                const [hFim, mFim] = parseTime(hFimMock);
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
                } as Usuario,
                entrada_hora: null,
                saida_hora: null,
                status_entrada: statusEntradaMock,
                status_saida: statusSaidaMock,
                cliente_id: clienteId,
                cliente: link.cliente,
                colaborador_cliente_id: link.id,
                detalhes_calculo: {
                    entrada: { 
                        turno_base: hIniMock, 
                        tolerancia: limiteAmarelo, 
                        diff_minutos: isHoje && nowTotalMin > inicioMinBase ? nowTotalMin - inicioMinBase : 0 
                    },
                    saida: { 
                        turno_base: hFimMock, 
                        tolerancia: 0, 
                        diff_minutos: 0 
                    },
                    resumo: {
                        horas_trabalhadas: "00:00",
                        horas_pausa: "00:00",
                        pausa_total: 0,
                        pausa_configurada: 0,
                        pausa_extra: 0,
                        km_trabalhado: 0,
                        km_pausa: 0
                    }
                },
                ausente: true
            } as unknown as RegistroPonto);
        });

        // 5. Adicionar pontos "sobrantes" que não bateram com links de turno (extra)
        const leftoverPontos = pontos?.filter((p) => !usedPointIds.has(p.id.toString())) || [];
        leftoverPontos.forEach((p) => {
            const user = users?.find((u) => u.id === p.usuario_id);
            mappedResults.push(formatPoint({ 
                ...p, 
                usuario: user ? { id: user.id, nome_completo: user.nome_completo } as unknown as Usuario : p.usuario 
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
    async getEspelhoPonto(clienteId: number, usuarioId: string, mes: number, ano: number): Promise<any> {
        // Aproveita a lógica consolidada de relatório, mas filtrando pelo cliente do link público
        const { pontoRelatorioService } = await import("./ponto-relatorio.service.js");
        const reports = await pontoRelatorioService.getEspelhoPonto(usuarioId, mes, ano);
        
        // Filtra para manter o consolidado (index 0) e os turnos pertencentes a este cliente
        return reports.filter(r => r.shift_id === 0 || String(r.cliente_id) === String(clienteId));
    }
};
