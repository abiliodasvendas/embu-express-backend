import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { PONTO_STATUS } from "../constants/ponto.enum.js";
import { TimeRecordRules } from "../utils/timeRecordRules.js";
import { getNowBR, toBRTime, toLocalDateString } from "../utils/utils.js";
import { AppError } from "../errors/AppError.js";
import { configuracaoService } from "./configuracao.service.js";
import { pontoCalculatorService, parseTime } from "./ponto-calculator.service.js";

// Interfaces
export interface PontoLocation {
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    address?: string | null;
    device?: string | null;
}

export interface PontoPayload {
    usuario_id: string;
    data_referencia: string;
    entrada_hora?: string | null;
    saida_hora?: string | null;
    entrada_km?: number | null;
    saida_km?: number | null;
    cliente_id?: number | null;
    empresa_id?: number | null;
    colaborador_cliente_id?: number | null;
    entrada_loc?: PontoLocation | null;
    saida_loc?: PontoLocation | null;
    observacao?: string | null;
    criado_por?: string;
    status_saida?: string;
}

export interface FiltrosPonto {
    data_referencia?: string;
    usuario_id?: string;
    cliente_id?: string;
    empresa_id?: number;
    incluir_todos?: boolean;
    searchTerm?: string;
    status_entrada?: string;
    status_saida?: string;
}

interface PausaPayload {
    ponto_id: number;
    inicio_hora?: string;
    fim_hora?: string;
    inicio_km?: number | null;
    fim_km?: number | null;
    inicio_loc?: PontoLocation | null;
    fim_loc?: PontoLocation | null;
}

// Helper para processar dados de localização
function processLocationData(loc: PontoLocation | null | undefined) {
    if (!loc) return { lat: null, lng: null, metadata: {} };
    return {
        lat: loc.latitude || null,
        lng: loc.longitude || null,
        metadata: {
            accuracy: loc.accuracy,
            address: loc.address,
            device: loc.device
        }
    };
}

// Helper para formatar campos de data/hora para o fuso de Brasília nos retornos da API
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
            created_at: pa.created_at ? toBRTime(pa.created_at) : null,
            updated_at: pa.updated_at ? toBRTime(pa.updated_at) : null
        }));
    }
    return result;
}

export const pontoService = {
    async registrarPonto(data: PontoPayload): Promise<any> {
        const entrada_hora = (data.entrada_hora ? toBRTime(data.entrada_hora) : getNowBR()) as string;
        const saida_hora = (data.saida_hora ? toBRTime(data.saida_hora) : null) as (string | null);

        // 1. Validações Básicas (Ordem e Duração)
        const orderCheck = TimeRecordRules.validateTimeOrder(entrada_hora, saida_hora);
        if (!orderCheck.valid) throw new AppError(orderCheck.message || "Erro de ordem");

        const durationCheck = TimeRecordRules.validateMinDuration(entrada_hora, saida_hora);
        if (!durationCheck.valid) throw new AppError(durationCheck.message || "Duração mínima");

        // 2. Validação de Sobreposição
        const { data: registrosDia, error: fetchError } = await supabaseAdmin
            .from("registros_ponto")
            .select("id, entrada_hora, saida_hora")
            .eq("usuario_id", data.usuario_id)
            .eq("data_referencia", data.data_referencia);

        if (fetchError) throw fetchError;

        if (registrosDia && registrosDia.length > 0) {
            const newStart = new Date(entrada_hora);
            const newEnd = saida_hora ? new Date(saida_hora) : null;
            const overlapCheck = TimeRecordRules.checkOverlap(newStart, newEnd, registrosDia);
            if (overlapCheck.hasOverlap) {
                // Sobreposição detectada
                throw new AppError("Já existe um registro de ponto que sobrepõe este horário.");
            }
        }

        // 3. Calcular status e detalhes antes de salvar
        const { status_entrada, status_saida, detalhes_calculo, saldo_minutos, melhorTurno } = await pontoCalculatorService.calculateStatus(
            data.usuario_id,
            entrada_hora,
            saida_hora,
            data.entrada_km,
            data.saida_km,
            0, // pausasMinutos
            0, // pausasKmTrabalhado
            0, // pausasKmPausa
            data.cliente_id || undefined,
            undefined,
            data.colaborador_cliente_id || undefined
        );

        // SMART LINKING: If no client provided, use the one from Best Shift
        let finalClienteId = data.cliente_id;
        let finalEmpresaId = data.empresa_id;
        let finalVinculoId = data.colaborador_cliente_id;

        if (melhorTurno) {
            if (!finalClienteId) finalClienteId = melhorTurno.cliente_id;
            if (!finalEmpresaId) finalEmpresaId = melhorTurno.empresa_id;
            if (!finalVinculoId) finalVinculoId = melhorTurno.id;
        }

        const { lat: eLat, lng: eLng, metadata: eMeta } = processLocationData(data.entrada_loc);
        const { lat: sLat, lng: sLng, metadata: sMeta } = processLocationData(data.saida_loc);

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created_at, updated_at, ...rest } = data as any;

        const payload = {
            ...rest,
            entrada_hora,
            saida_hora,
            entrada_km: data.entrada_km ?? null,
            saida_km: data.saida_km ?? null,
            status_entrada,
            status_saida: saida_hora ? (data.status_saida || status_saida) : null,
            detalhes_calculo,
            saldo_minutos,
            cliente_id: finalClienteId,
            empresa_id: finalEmpresaId,
            colaborador_cliente_id: finalVinculoId,
            entrada_loc: data.entrada_loc || null,
            saida_loc: data.saida_loc || null,
            entrada_lat: eLat,
            entrada_lng: eLng,
            entrada_metadata: eMeta,
            saida_lat: sLat,
            saida_lng: sLng,
            saida_metadata: sMeta
        };

        const { data: inserted, error } = await supabaseAdmin
            .from("registros_ponto")
            .insert([payload])
            .select();

        if (error) throw error;

        // --- LÓGICA DE BÔNUS DE FERIADO ---
        if (!saida_hora && melhorTurno && melhorTurno.id) {
            try {
                const { data: feriados } = await supabaseAdmin
                    .from("feriados")
                    .select("id, descricao")
                    .eq("data", data.data_referencia);

                if (feriados && feriados.length > 0) {
                    const feriado = feriados[0];
                    const configFeriado = await configuracaoService.getConfiguracao("valor_adicional_feriado");
                    const valorFeriado = configFeriado?.valor ? Number(configFeriado.valor) : 0;

                    if (valorFeriado > 0) {
                        let tipoOcorrenciaId = null;
                        const { data: tipos } = await supabaseAdmin
                            .from("tipos_ocorrencia")
                            .select("id")
                            .ilike("descricao", "Feriado Trabalhado");

                        if (tipos && tipos.length > 0) {
                            tipoOcorrenciaId = tipos[0].id;
                        } else {
                            const { data: novoTipo } = await supabaseAdmin
                                .from("tipos_ocorrencia")
                                .insert([{ descricao: "Feriado Trabalhado", impacto_financeiro: true }])
                                .select()
                                .single();
                            tipoOcorrenciaId = novoTipo?.id;
                        }

                        if (tipoOcorrenciaId) {
                            await supabaseAdmin.from("ocorrencias").insert([{
                                colaborador_id: data.usuario_id,
                                colaborador_cliente_id: melhorTurno.id,
                                tipo_id: tipoOcorrenciaId,
                                data_ocorrencia: getNowBR(),
                                valor: valorFeriado,
                                impacto_financeiro: true,
                                tipo_lancamento: "ENTRADA",
                                observacao: `Inclusão automática: ${feriado.descricao || 'Feriado Trabalhado'}`,
                                criado_por: data.usuario_id
                            }]);
                        }
                    }
                }
            } catch (feriadoError) {
                console.error("Erro ao processar bônus automático de feriado:", feriadoError);
            }
        }

        return formatPoint(inserted?.[0]);
    },

    async updatePonto(id: number, data: Partial<PontoPayload>): Promise<any> {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _, created_at, updated_at, ...rest } = data as any;
        const payload: any = { ...rest };

        if (data.entrada_hora || data.saida_hora !== undefined) {
            const existing = await this.getPonto(id);
            if (!existing) throw new AppError("Registro de ponto não encontrado", 404);

            const entrada = (data.entrada_hora ? toBRTime(data.entrada_hora) : existing.entrada_hora) as string;
            const saida = (data.saida_hora !== undefined ? (data.saida_hora ? toBRTime(data.saida_hora) : null) : existing.saida_hora) as (string | null);

            const entradaKmRaw = data.entrada_km !== undefined ? String(data.entrada_km).replace(/\D/g, "") : String(existing.entrada_km || "");
            const saidaKmRaw = data.saida_km !== undefined ? String(data.saida_km).replace(/\D/g, "") : String(existing.saida_km || "");
            
            const entradaKm = entradaKmRaw ? parseInt(entradaKmRaw, 10) : null;
            const saidaKm = saidaKmRaw ? parseInt(saidaKmRaw, 10) : null;

            if (entrada && saida) {
                const orderCheck = TimeRecordRules.validateTimeOrder(entrada, saida);
                if (!orderCheck.valid) throw new AppError(orderCheck.message || "Erro de ordem");

                const maxConfirm = TimeRecordRules.validateMaxDuration(entrada, saida);
                if (!maxConfirm.valid) throw new AppError(maxConfirm.message || "Duração excessiva");
            }

            const { data: pausas_db } = await supabaseAdmin
                .from("registros_pausas")
                .select("inicio_hora, fim_hora, distancia_trabalho, distancia_pausa")
                .eq("ponto_id", id);

            let totalPausasMin = 0;
            let totalKmTrab = 0;
            let totalKmPausa = 0;

            if (pausas_db && pausas_db.length > 0) {
                pausas_db.forEach(p => {
                    if (p.inicio_hora && p.fim_hora) {
                        const start = new Date(p.inicio_hora).getTime();
                        const end = new Date(p.fim_hora).getTime();
                        totalPausasMin += Math.round((end - start) / 60000);
                    }
                    totalKmTrab += Number(p.distancia_trabalho || 0);
                    totalKmPausa += Number(p.distancia_pausa || 0);
                });
            }

            const clienteIdAtualValue = data.cliente_id !== undefined ? data.cliente_id : existing.cliente_id;
            const clienteMudou = data.cliente_id !== undefined && data.cliente_id !== existing.cliente_id;

            let snapshot: any = undefined;
            if (!clienteMudou && existing.detalhes_calculo?.entrada?.turno_base && existing.detalhes_calculo?.saida?.turno_base) {
                snapshot = {
                    hora_inicio: existing.detalhes_calculo.entrada.turno_base,
                    hora_fim: existing.detalhes_calculo.saida.turno_base,
                    tolerancia_pausa_min: existing.detalhes_calculo.resumo?.pausa_configurada || 0
                };
            }

            let kmTrabalhadoFinal = totalKmTrab;
            if (saida && saidaKm) {
                let lastKmForExit = 0;
                const { data: lastPausaForExit } = await supabaseAdmin
                    .from("registros_pausas")
                    .select("fim_km")
                    .eq("ponto_id", id)
                    .not("fim_hora", "is", null)
                    .order("id", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                
                lastKmForExit = lastPausaForExit?.fim_km || existing.entrada_km || 0;
                payload.saida_distancia_trabalho = Math.max(0, saidaKm - lastKmForExit);
                kmTrabalhadoFinal += payload.saida_distancia_trabalho;
            }

            const { status_entrada, status_saida, detalhes_calculo, saldo_minutos, melhorTurno } = await pontoCalculatorService.calculateStatus(
                existing.usuario_id,
                entrada,
                saida,
                entradaKm,
                saidaKm,
                Math.round(totalPausasMin),
                kmTrabalhadoFinal,
                totalKmPausa,
                clienteIdAtualValue || undefined,
                snapshot,
                existing.colaborador_cliente_id
            );

            if (melhorTurno) {
                if (!existing.colaborador_cliente_id || clienteMudou) {
                    payload.colaborador_cliente_id = melhorTurno.id;
                    payload.empresa_id = melhorTurno.empresa_id;
                }
            }

            payload.status_entrada = status_entrada;
            payload.status_saida = status_saida;
            payload.detalhes_calculo = detalhes_calculo;
            payload.saldo_minutos = saldo_minutos;
        }

        if (data.entrada_loc) {
            const { lat, lng, metadata } = processLocationData(data.entrada_loc);
            payload.entrada_lat = lat;
            payload.entrada_lng = lng;
            payload.entrada_metadata = metadata;
        }

        if (data.saida_loc) {
            const { lat, lng, metadata } = processLocationData(data.saida_loc);
            payload.saida_lat = lat;
            payload.saida_lng = lng;
            payload.saida_metadata = metadata;
        }

        const { data: updated, error } = await supabaseAdmin
            .from("registros_ponto")
            .update(payload)
            .eq("id", id)
            .select();

        if (error) throw error;
        return formatPoint(updated?.[0]);
    },

    async getPonto(id: number): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("registros_ponto")
            .select("*, cliente:clientes(*), usuario:usuarios!registros_ponto_usuario_id_fkey(*), pausas:registros_pausas(*)")
            .eq("id", id)
            .limit(1);
        if (error) throw error;
        return formatPoint(data?.[0]);
    },

    async listPontos(filtros?: FiltrosPonto): Promise<any[]> {
        if (filtros?.incluir_todos) {
            const dataRef = filtros.data_referencia || toLocalDateString(new Date());

            let userQuery = supabaseAdmin
                .from("usuarios")
                .select("*, perfil:perfis(*), links:colaborador_clientes!inner(*, cliente:clientes(*))")
                .eq("status", "ATIVO");

            if (filtros.cliente_id && filtros.cliente_id !== 'todos') {
                userQuery = userQuery.eq("links.cliente_id", filtros.cliente_id);
            }

            if (filtros.searchTerm) {
                userQuery = userQuery.or(`nome_completo.ilike.%${filtros.searchTerm}%,cpf.ilike.%${filtros.searchTerm}%`);
            }

            if (filtros.usuario_id && filtros.usuario_id !== 'todos') {
                userQuery = userQuery.eq("id", filtros.usuario_id);
            }

            const { data: users, error: userError } = await userQuery;
            if (userError) throw userError;

            const dateObj = new Date(dataRef + "T12:00:00Z");
            let dayOfWeek = dateObj.getUTCDay();
            const scaleDay = dayOfWeek === 0 ? 7 : dayOfWeek;

            const activeLinks: any[] = [];
            users?.forEach(u => {
                u.links?.forEach((link: any) => {
                    const isVigente = !link.data_fim || link.data_fim >= dataRef;
                    const naEscala = link.cliente?.escala_semanal?.includes(scaleDay);
                    if (isVigente && naEscala) {
                        activeLinks.push({ ...link, usuario: u });
                    }
                });
            });

            if (activeLinks.length === 0) return [];

            const userIds = users.map(u => u.id);
            const { data: pontos, error: pontoError } = await supabaseAdmin
                .from("registros_ponto")
                .select("*, cliente:clientes(nome_fantasia), pausas:registros_pausas(*)")
                .in("usuario_id", userIds)
                .eq("data_referencia", dataRef);

            if (pontoError) throw pontoError;

            const [limiteAmarelo] = await Promise.all([
                configuracaoService.getConfiguracao("tolerancia_amarelo_min").then(d => Number(d?.valor || 15))
            ]);

            const hoje = toLocalDateString();
            const isHoje = dataRef === hoje;
            const isFuturo = dataRef > hoje;
            let nowTotalMin = 0;
            if (isHoje) {
                const nowStr = getNowBR();
                const [h, m] = parseTime(nowStr);
                nowTotalMin = h * 60 + m;
            }

            const usedPointIds = new Set<string>();
            const mappedResults = activeLinks.map(link => {
                const ponto = pontos?.find(p =>
                    p.usuario_id === link.colaborador_id &&
                    (
                        (p.colaborador_cliente_id && String(p.colaborador_cliente_id) === String(link.id)) ||
                        (!p.colaborador_cliente_id && p.cliente_id === link.cliente_id && p.detalhes_calculo?.entrada?.turno_base === link.hora_inicio)
                    )
                );

                if (ponto) {
                    usedPointIds.add(ponto.id.toString());
                    const formattedPonto = formatPoint(ponto);
                    if (!formattedPonto.saida_hora) {
                        const [hFim, mFim] = parseTime(link.hora_fim);
                        const [hIni, mIni] = parseTime(link.hora_inicio);
                        let fimMin = hFim * 60 + mFim;
                        const iniMin = hIni * 60 + mIni;
                        if (fimMin < iniMin) fimMin += 1440;
                        const isOpenTooLong = (!isHoje && !isFuturo) || (isHoje && nowTotalMin > (fimMin + 240));
                        if (isOpenTooLong) formattedPonto.status_saida = PONTO_STATUS.PENDENTE;
                    }
                    return { ...formattedPonto, usuario: link.usuario };
                }

                let statusEntradaMock = PONTO_STATUS.AUSENTE;
                let statusSaidaMock = PONTO_STATUS.AUSENTE;

                if (isFuturo) {
                    statusEntradaMock = PONTO_STATUS.CINZA;
                    statusSaidaMock = PONTO_STATUS.CINZA;
                } else if (isHoje) {
                    const [hInicio, mInicio] = parseTime(link.hora_inicio);
                    const [hFim, mFim] = parseTime(link.hora_fim);
                    const inicioMin = hInicio * 60 + mInicio;
                    let fimMin = hFim * 60 + mFim;
                    if (fimMin < inicioMin) fimMin += 1440;

                    if (nowTotalMin < inicioMin) statusEntradaMock = PONTO_STATUS.CINZA;
                    else if (nowTotalMin === inicioMin) statusEntradaMock = PONTO_STATUS.VERDE;
                    else if (nowTotalMin > fimMin) statusEntradaMock = PONTO_STATUS.AUSENTE;
                    else if (nowTotalMin <= inicioMin + limiteAmarelo) statusEntradaMock = PONTO_STATUS.AMARELO;
                    else statusEntradaMock = PONTO_STATUS.VERMELHO;

                    statusSaidaMock = nowTotalMin > fimMin ? PONTO_STATUS.AUSENTE : PONTO_STATUS.CINZA;
                }

                const [hBase, mBase] = parseTime(link.hora_inicio);
                const inicioMinBase = hBase * 60 + mBase;

                return formatPoint({
                    id: `ausente-${link.id}`,
                    usuario_id: link.colaborador_id,
                    data_referencia: dataRef,
                    usuario: link.usuario,
                    entrada_hora: null,
                    saida_hora: null,
                    status_entrada: statusEntradaMock,
                    status_saida: statusSaidaMock,
                    cliente_id: link.cliente_id,
                    cliente: link.cliente,
                    empresa_id: link.empresa_id,
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

            const leftoverPontos = pontos?.filter(p => !usedPointIds.has(p.id.toString())) || [];
            leftoverPontos.forEach(p => {
                const user = users.find(u => u.id === p.usuario_id);
                mappedResults.push({ ...p, usuario: user || p.usuario });
            });

            let finalResults = mappedResults;
            if (filtros.status_entrada && filtros.status_entrada !== 'todos') {
                if (filtros.status_entrada === 'iniciou') finalResults = finalResults.filter(p => !p.ausente && p.entrada_hora);
                else if (filtros.status_entrada === 'nao_iniciou') finalResults = finalResults.filter(p => p.ausente);
                else if (filtros.status_entrada === 'em_atraso') finalResults = finalResults.filter(p => p.ausente && (p.status_entrada === PONTO_STATUS.AMARELO || p.status_entrada === PONTO_STATUS.VERMELHO));
                else if (filtros.status_entrada === 'aguardando') finalResults = finalResults.filter(p => p.ausente && p.status_entrada === PONTO_STATUS.CINZA);
                else finalResults = finalResults.filter(p => p.status_entrada === filtros.status_entrada);
            }

            if (filtros.status_saida && filtros.status_saida !== 'todos') {
                if (filtros.status_saida === 'trabalhando') finalResults = finalResults.filter(p => !p.saida_hora && !p.ausente && p.entrada_hora);
                else if (filtros.status_saida === 'concluiu') finalResults = finalResults.filter(p => p.saida_hora && !p.ausente);
                else finalResults = finalResults.filter(p => p.status_saida === filtros.status_saida);
            }

            return finalResults.sort((a, b) => {
                const nomeA = a.usuario?.nome_completo?.toLowerCase() || "";
                const nomeB = b.usuario?.nome_completo?.toLowerCase() || "";
                if (nomeA !== nomeB) return nomeA.localeCompare(nomeB);
                return new Date(b.data_referencia).getTime() - new Date(a.data_referencia).getTime();
            });
        }

        let query = supabaseAdmin
            .from("registros_ponto")
            .select("*, cliente:clientes(nome_fantasia), usuario:usuarios!registros_ponto_usuario_id_fkey!inner(*, links:colaborador_clientes(cliente:clientes(nome_fantasia))), pausas:registros_pausas(*)")
            .order("data_referencia", { ascending: false });

        if (filtros?.data_referencia) query = query.eq("data_referencia", filtros.data_referencia);

        if (filtros?.status_entrada && filtros.status_entrada !== 'todos') {
            if (filtros.status_entrada === 'iniciou') query = query.not("entrada_hora", "is", null);
            else query = query.eq("status_entrada", filtros.status_entrada);
        }

        if (filtros?.status_saida && filtros.status_saida !== 'todos') {
            if (filtros.status_saida === 'trabalhando') query = query.is("saida_hora", null);
            else if (filtros.status_saida === 'concluiu') query = query.not("saida_hora", "is", null);
            else query = query.eq("status_saida", filtros.status_saida);
        }

        if (filtros?.usuario_id && filtros.usuario_id !== 'todos') query = query.eq("usuario_id", filtros.usuario_id);

        if (filtros?.searchTerm) {
            query = query.or(`usuario.nome_completo.ilike.%${filtros.searchTerm}%,usuario.cpf.ilike.%${filtros.searchTerm}%`);
        }

        const { data, error } = await query;
        if (error) throw error;

        const results = (data || []).map(formatPoint);
        return results.sort((a, b) => {
            const nomeA = a.usuario?.nome_completo?.toLowerCase() || "";
            const nomeB = b.usuario?.nome_completo?.toLowerCase() || "";
            if (nomeA !== nomeB) return nomeA.localeCompare(nomeB);
            return new Date(b.data_referencia).getTime() - new Date(a.data_referencia).getTime();
        });
    },

    async getPontoHoje(usuarioId: string): Promise<any> {
        const hoje = toLocalDateString(new Date(getNowBR()));
        const { data, error } = await supabaseAdmin
            .from("registros_ponto")
            .select("*, cliente:clientes(*), pausas:registros_pausas(*)")
            .eq("usuario_id", usuarioId)
            .eq("data_referencia", hoje)
            .order("entrada_hora", { ascending: false })
            .limit(1);

        if (error) throw error;
        return formatPoint(data?.[0]) || null;
    },

    async togglePonto(usuarioId: string, location?: PontoLocation, km?: number, clienteId?: number, empresaId?: number, colaboradorClienteId?: number): Promise<{ action: 'OPEN' | 'CLOSE', record: any }> {
        const now = getNowBR();
        const { data: lastRecords, error } = await supabaseAdmin
            .from("registros_ponto")
            .select("*")
            .eq("usuario_id", usuarioId)
            .order("id", { ascending: false })
            .limit(1);

        if (error) throw error;
        const lastRecord = lastRecords?.[0];
        const nowSEO = new Date(now);

        if (lastRecord && !lastRecord.saida_hora) {
            const entryDate = new Date(lastRecord.entrada_hora);
            const diffMs = nowSEO.getTime() - entryDate.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            if (diffHours < 16) {
                const updated = await this.updatePonto(lastRecord.id, {
                    saida_hora: now,
                    saida_loc: location,
                    saida_km: km
                });
                return { action: 'CLOSE', record: updated };
            }
        }

        const newRecord = await this.registrarPonto({
            usuario_id: usuarioId,
            data_referencia: toLocalDateString(nowSEO),
            entrada_hora: now,
            saida_hora: null,
            criado_por: usuarioId,
            entrada_loc: location,
            entrada_km: km,
            cliente_id: clienteId,
            empresa_id: empresaId,
            colaborador_cliente_id: colaboradorClienteId
        });
        return { action: 'OPEN', record: formatPoint(newRecord) };
    },

    async deletePonto(id: number): Promise<void> {
        const { error } = await supabaseAdmin.from("registros_ponto").delete().eq("id", id);
        if (error) throw error;
    },

    async iniciarPausa(data: PausaPayload): Promise<any> {
        if (!data.ponto_id) throw new AppError(messages.ponto.erro.idPontoObrigatorio);
        const inicio_hora = data.inicio_hora ? toBRTime(data.inicio_hora) : getNowBR();

        const { data: openPausas } = await supabaseAdmin
            .from("registros_pausas")
            .select("id")
            .eq("ponto_id", data.ponto_id)
            .is("fim_hora", null)
            .limit(1);

        if (openPausas && openPausas.length > 0) throw new AppError(messages.ponto.erro.pausaAberta);

        const { data: pointData } = await supabaseAdmin.from("registros_ponto").select("entrada_km").eq("id", data.ponto_id).single();
        const { data: lastPausa } = await supabaseAdmin.from("registros_pausas").select("fim_km").eq("ponto_id", data.ponto_id).not("fim_hora", "is", null).order("id", { ascending: false }).limit(1).maybeSingle();

        const lastKm = lastPausa?.fim_km || pointData?.entrada_km || 0;
        const distanciaTrabalho = data.inicio_km ? Math.max(0, data.inicio_km - lastKm) : 0;
        const { lat, lng, metadata } = processLocationData(data.inicio_loc);

        const { data: inserted, error } = await supabaseAdmin
            .from("registros_pausas")
            .insert([{
                ponto_id: data.ponto_id,
                inicio_hora,
                inicio_km: data.inicio_km,
                inicio_loc: data.inicio_loc,
                inicio_lat: lat,
                inicio_lng: lng,
                inicio_metadata: metadata,
                distancia_trabalho: distanciaTrabalho
            }])
            .select();

        if (error) throw error;
        const insertedRec = inserted?.[0];
        if (insertedRec) {
            insertedRec.inicio_hora = toBRTime(insertedRec.inicio_hora);
            if (insertedRec.fim_hora) insertedRec.fim_hora = toBRTime(insertedRec.fim_hora);
        }
        return insertedRec;
    },

    async finalizarPausa(id: number, data: Partial<PausaPayload>): Promise<any> {
        const fim_hora = data.fim_hora ? toBRTime(data.fim_hora) : getNowBR();
        const { data: currentPausa } = await supabaseAdmin.from("registros_pausas").select("inicio_km, ponto_id").eq("id", id).single();
        if (!currentPausa) throw new AppError("Pausa não encontrada", 404);

        const distanciaPausa = (data.fim_km && currentPausa.inicio_km) ? Math.max(0, data.fim_km - currentPausa.inicio_km) : 0;
        const { lat, lng, metadata } = processLocationData(data.fim_loc);

        const { data: updated, error } = await supabaseAdmin
            .from("registros_pausas")
            .update({
                fim_hora,
                fim_km: data.fim_km,
                fim_loc: data.fim_loc,
                fim_lat: lat,
                fim_lng: lng,
                fim_metadata: metadata,
                distancia_pausa: distanciaPausa
            })
            .eq("id", id)
            .select();

        if (error) throw error;
        const result = updated[0];
        if (result) {
            result.inicio_hora = toBRTime(result.inicio_hora);
            if (result.fim_hora) result.fim_hora = toBRTime(result.fim_hora);
            if (result.ponto_id) await this.updatePonto(result.ponto_id, {});
        }
        return result;
    },

    async getUltimoKm(usuarioId: string): Promise<number> {
        const { data: lastPontos } = await supabaseAdmin.from("registros_ponto").select("id, entrada_km, saida_km").eq("usuario_id", usuarioId).order("id", { ascending: false }).limit(1);
        const lastPonto = lastPontos?.[0] || null;

        const { data: lastPausas } = await supabaseAdmin.from("registros_pausas").select("inicio_km, fim_km").eq("ponto_id", lastPonto?.id || 0).order("id", { ascending: false }).limit(1);
        const lastPausa = lastPausas?.[0] || null;

        const kmas = [lastPonto?.entrada_km || 0, lastPonto?.saida_km || 0, lastPausa?.inicio_km || 0, lastPausa?.fim_km || 0];

        if (Math.max(...kmas) === 0) {
            const { data: absoluteLasts } = await supabaseAdmin.from("registros_ponto").select("saida_km, entrada_km").eq("usuario_id", usuarioId).not("entrada_km", "is", null).order("id", { ascending: false }).limit(1);
            if (absoluteLasts?.[0]) return absoluteLasts[0].saida_km || absoluteLasts[0].entrada_km || 0;
        }

        return Math.max(...kmas);
    },

    async getRelatorioMensal(usuarioId: string, mes: number, ano: number): Promise<any[]> {
        const lastDay = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const { data, error } = await supabaseAdmin
            .from("v_relatorio_mensal_ponto")
            .select("*")
            .eq("usuario_id", usuarioId)
            .filter("data_referencia", "gte", `${ano}-${String(mes).padStart(2, '0')}-01`)
            .filter("data_referencia", "lte", `${ano}-${String(mes).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`)
            .order("data_referencia", { ascending: false });

        if (error) throw error;
        return data || [];
    }
};
