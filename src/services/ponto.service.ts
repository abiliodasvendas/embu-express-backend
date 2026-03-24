import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";
import { FilterOptions } from "../constants/filters.enum.js";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { PONTO_STATUS } from "../constants/ponto.enum.js";
import { TimeRecordRules } from "../utils/timeRecordRules.js";
import { getNowBR, toBRTime, toLocalDateString, onlyNumbers, formatPoint } from "../utils/utils.js";
import { AppError } from "../errors/AppError.js";
import { configuracaoService } from "./configuracao.service.js";
import { pontoCalculatorService, parseTime } from "./ponto-calculator.service.js";
import { RegistroPonto, PontoLocation as DatabasePontoLocation, Pausa, ColaboradorCliente, Usuario, DetalhesCalculo } from "../types/database.js";

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
function processLocationData(loc: PontoLocation | null | undefined): DatabasePontoLocation {
    if (!loc) return { lat: 0, lng: 0, accuracy: 0, address: "" };
    return {
        lat: loc.latitude || 0,
        lng: loc.longitude || 0,
        accuracy: loc.accuracy || undefined,
        address: loc.address || undefined
    };
}


export const pontoService = {
    async registrarPonto(data: PontoPayload): Promise<RegistroPonto> {
        const entrada_hora = (data.entrada_hora ? toBRTime(data.entrada_hora) : getNowBR()) as string;
        const saida_hora = (data.saida_hora ? toBRTime(data.saida_hora) : null) as (string | null);

        const orderCheck = TimeRecordRules.validateTimeOrder(entrada_hora, saida_hora);
        if (!orderCheck.valid) throw new AppError(orderCheck.message || "Erro de ordem");

        const durationCheck = TimeRecordRules.validateMinDuration(entrada_hora, saida_hora);
        if (!durationCheck.valid) throw new AppError(durationCheck.message || "Duração mínima");

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
                throw new AppError(messages.ponto.erro.sobreposicao);
            }
        }

        const { status_entrada, status_saida, detalhes_calculo, saldo_minutos, melhorTurno } = await pontoCalculatorService.calculateStatus(
            data.usuario_id,
            entrada_hora,
            saida_hora,
            data.entrada_km,
            data.saida_km,
            0,
            0,
            0,
            data.cliente_id || undefined,
            undefined,
            data.colaborador_cliente_id || undefined
        );

        let finalClienteId = data.cliente_id;
        let finalEmpresaId = data.empresa_id;
        let finalVinculoId = data.colaborador_cliente_id;

        if (melhorTurno) {
            if (!finalClienteId) finalClienteId = melhorTurno.cliente_id;
            if (!finalEmpresaId) finalEmpresaId = melhorTurno.empresa_id;
            if (!finalVinculoId) finalVinculoId = melhorTurno.id;
        }

        const eLoc = processLocationData(data.entrada_loc);
        const sLoc = processLocationData(data.saida_loc);

        const { ...rest } = data;

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
            entrada_loc: eLoc,
            saida_loc: sLoc,
            entrada_lat: eLoc.lat,
            entrada_lng: eLoc.lng,
            entrada_metadata: { accuracy: eLoc.accuracy, address: eLoc.address, device: data.entrada_loc?.device },
            saida_lat: sLoc.lat,
            saida_lng: sLoc.lng,
            saida_metadata: { accuracy: sLoc.accuracy, address: sLoc.address, device: data.saida_loc?.device }
        };

        const { data: inserted, error } = await supabaseAdmin
            .from("registros_ponto")
            .insert([payload])
            .select()
            .single();

        if (error) throw error;

        // Processa bônus de feriado se houver turno vinculado
        if (inserted?.colaborador_cliente_id) {
            await this.processarBonusFeriado(inserted.usuario_id, inserted.data_referencia, String(inserted.colaborador_cliente_id));
        }

        return formatPoint(inserted as unknown as RegistroPonto);
    },

    async processarBonusFeriado(usuarioId: string, dataReferencia: string, colaboradorClienteId: string): Promise<void> {
        try {
            const { data: feriados } = await supabaseAdmin
                .from("feriados")
                .select("id, descricao")
                .eq("data", dataReferencia);

            if (!feriados || feriados.length === 0) return;

            const feriado = feriados[0];
            const configFeriado = await configuracaoService.getConfiguracao("valor_adicional_feriado");
            const valorFeriado = configFeriado?.valor ? Number(configFeriado.valor) : 0;


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

            if (!tipoOcorrenciaId) return;

            // Verifica se já existe uma ocorrência de feriado para este colaborador nesta data e turno
            const { data: existingOcorrencia } = await supabaseAdmin
                .from("ocorrencias")
                .select("id")
                .eq("colaborador_id", usuarioId)
                .eq("colaborador_cliente_id", colaboradorClienteId)
                .eq("data_ocorrencia", dataReferencia)
                .eq("tipo_id", tipoOcorrenciaId)
                .maybeSingle();

            if (!existingOcorrencia) {
                await supabaseAdmin.from("ocorrencias").insert([{
                    colaborador_id: usuarioId,
                    colaborador_cliente_id: colaboradorClienteId,
                    tipo_id: tipoOcorrenciaId,
                    data_ocorrencia: dataReferencia,
                    valor: valorFeriado,
                    impacto_financeiro: true,
                    tipo_lancamento: "ENTRADA",
                    observacao: `Inclusão automática: ${feriado.descricao || 'Feriado Trabalhado'}`,
                    criado_por: usuarioId
                }]);
            }
        } catch (error) {
            console.error("Erro ao processar bônus automático de feriado:", error);
        }
    },

    async updatePonto(id: number, data: Partial<PontoPayload> & { force_recalculate?: boolean }): Promise<RegistroPonto> {
        const { entrada_loc: _e, saida_loc: _s, force_recalculate, ...rest } = data;
        const payload: Partial<RegistroPonto> = {
            ...rest as unknown as Partial<RegistroPonto>,
            updated_at: getNowBR()
        };

        if (data.entrada_hora || data.saida_hora !== undefined || force_recalculate) {
            const existing = await this.getPonto(id);
            if (!existing) throw new AppError(messages.ponto.erro.naoEncontrado, 404);

            const entrada = (data.entrada_hora ? toBRTime(data.entrada_hora) : existing.entrada_hora) as string;
            const saida = (data.saida_hora !== undefined ? (data.saida_hora ? toBRTime(data.saida_hora) : null) : existing.saida_hora) as (string | null);

            const entradaKmRaw = data.entrada_km !== undefined ? onlyNumbers(String(data.entrada_km)) : String(existing.entrada_km || "");
            const saidaKmRaw = data.saida_km !== undefined ? onlyNumbers(String(data.saida_km)) : String(existing.saida_km || "");

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

            let snapshot: Partial<ColaboradorCliente> | undefined = undefined;
            if (!clienteMudou && existing.detalhes_calculo?.entrada?.turno_base && existing.detalhes_calculo?.saida?.turno_base) {
                // Determine the day of week for the record to build a valid snapshot
                const dateObj = new Date(entrada);
                let dayOfWeek = dateObj.getDay();
                if (dayOfWeek === 0) dayOfWeek = 7;

                snapshot = {
                    horarios: [{
                        dia_semana: dayOfWeek,
                        hora_inicio: existing.detalhes_calculo.entrada.turno_base,
                        hora_fim: existing.detalhes_calculo.saida.turno_base,
                        tolerancia_pausa_min: existing.detalhes_calculo.resumo?.pausa_configurada || 0
                    } as any]
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
                entradaKm ?? undefined,
                saidaKm ?? undefined,
                Math.round(totalPausasMin),
                kmTrabalhadoFinal,
                totalKmPausa,
                clienteIdAtualValue || undefined,
                snapshot,
                existing.colaborador_cliente_id ?? undefined
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
            const loc = processLocationData(data.entrada_loc);
            payload.entrada_lat = loc.lat;
            payload.entrada_lng = loc.lng;
            payload.entrada_metadata = { accuracy: loc.accuracy, address: loc.address || undefined, device: data.entrada_loc?.device || undefined };
        }

        if (data.saida_loc) {
            const loc = processLocationData(data.saida_loc);
            payload.saida_lat = loc.lat;
            payload.saida_lng = loc.lng;
            payload.saida_metadata = { accuracy: loc.accuracy, address: loc.address || undefined, device: data.saida_loc?.device || undefined };
        }

        const { data: updated, error } = await supabaseAdmin
            .from("registros_ponto")
            .update(payload)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        // Ao atualizar um ponto (ex: preenchimento manual retroativo), verifica se deve gerar bônus de feriado
        const registro = updated as any;
        if (registro?.colaborador_cliente_id) {
            await this.processarBonusFeriado(registro.usuario_id, registro.data_referencia, String(registro.colaborador_cliente_id));
        }

        return formatPoint(updated as unknown as RegistroPonto);
    },

    async getPonto(id: number): Promise<RegistroPonto | null> {
        const { data, error } = await supabaseAdmin
            .from("registros_ponto")
            .select("*, cliente:clientes(*), usuario:usuarios!registros_ponto_usuario_id_fkey(*), colaborador_cliente:colaborador_clientes(*, cliente:clientes(nome_fantasia), unidade:unidades_cliente(*)), pausas:registros_pausas(*)")
            .eq("id", id)
            .maybeSingle();
        if (error) throw error;
        return formatPoint(data as unknown as RegistroPonto);
    },

    async listPontos(filtros?: FiltrosPonto): Promise<RegistroPonto[]> {
        if (filtros?.incluir_todos) {
            const dataRef = filtros.data_referencia || toLocalDateString(new Date());

            let userQuery = supabaseAdmin
                .from("usuarios")
                .select("*, perfil:perfis(*), links:colaborador_clientes!inner(*, cliente:clientes(*), unidade:unidades_cliente(*), horarios:colaborador_cliente_horarios(*))")
                .eq("status", CADASTRO_STATUS.ATIVO);

            if (filtros.cliente_id && filtros.cliente_id !== FilterOptions.TODOS) {
                userQuery = userQuery.eq("links.cliente_id", filtros.cliente_id);
            }

            if (filtros.searchTerm) {
                userQuery = userQuery.or(`nome_completo.ilike.%${filtros.searchTerm}%,cpf.ilike.%${filtros.searchTerm}%`);
            }

            if (filtros.usuario_id && filtros.usuario_id !== FilterOptions.TODOS) {
                userQuery = userQuery.eq("id", filtros.usuario_id);
            }

            const { data: users, error: userError } = await userQuery;
            if (userError) throw userError;

            const dateObj = new Date(dataRef + "T12:00:00Z");
            let dayOfWeek = dateObj.getUTCDay();
            const scaleDay = dayOfWeek === 0 ? 7 : dayOfWeek;

            const activeLinks: (ColaboradorCliente & { usuario: Usuario })[] = [];
            users?.forEach(u => {
                u.links?.forEach((link: ColaboradorCliente) => {
                    const isVigente = !link.data_fim || link.data_fim >= dataRef;
                    // O horário do dia no vínculo agora define a obrigação (substitui a escala do cliente)
                    const hConfig = link.horarios?.find(h => h.dia_semana === scaleDay);
                    const naEscala = !!hConfig;

                    if (isVigente && naEscala) {
                        activeLinks.push({ ...link, usuario: u as Usuario });
                    }
                });
            });

            if (activeLinks.length === 0) return [];

            const userIds = users.map(u => u.id);
            const { data: pontos, error: pontoError } = await supabaseAdmin
                .from("registros_ponto")
                .select("*, cliente:clientes(nome_fantasia), colaborador_cliente:colaborador_clientes(unidade:unidades_cliente(nome_unidade)), pausas:registros_pausas(*)")
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
                        (p.colaborador_cliente_id && String(p.colaborador_cliente_id) === String(link.id))
                    )
                );

                if (ponto) {
                    usedPointIds.add(ponto.id.toString());
                    const formattedPonto = formatPoint(ponto);
                    if (!formattedPonto.saida_hora) {
                        const hConfig = link.horarios?.find(h => h.dia_semana === scaleDay);
                        const hFimStr = hConfig?.hora_fim || '00:00';
                        const hIniStr = hConfig?.hora_inicio || '00:00';

                        const [hFim, mFim] = parseTime(hFimStr);
                        const [hIni, mIni] = parseTime(hIniStr);
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

                const hConfig = link.horarios?.find(h => h.dia_semana === scaleDay);
                const hIniMock = hConfig?.hora_inicio || '00:00';
                const hFimMock = hConfig?.hora_fim || '00:00';
                const tolPausaMock = hConfig?.tolerancia_pausa_min ?? 0;

                if (isFuturo) {
                    statusEntradaMock = PONTO_STATUS.CINZA;
                    statusSaidaMock = PONTO_STATUS.CINZA;
                } else if (isHoje) {
                    const [hInicio, mInicio] = parseTime(hIniMock);
                    const [hFim, mFim] = parseTime(hFimMock);
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

                const [hBase, mBase] = parseTime(hIniMock);
                const inicioMinBase = hBase * 60 + mBase;

                return formatPoint({
                    id: link.id, // Using link.id as a numeric placeholder
                    usuario_id: link.colaborador_id,
                    data_referencia: dataRef,
                    usuario: link.usuario,
                    entrada_hora: null,
                    saida_hora: null,
                    status_entrada: statusEntradaMock,
                    status_saida: statusSaidaMock,
                    cliente_id: link.cliente_id,
                    cliente: link.cliente,
                    colaborador_cliente: link,
                    empresa_id: link.empresa_id,
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
                            horas_trabalhadas: "--:--",
                            horas_pausa: "0h 0min",
                            pausa_total: 0,
                            pausa_configurada: tolPausaMock,
                            pausa_extra: 0,
                            km_trabalhado: 0,
                            km_pausa: 0
                        }
                    },
                    ausente: true
                } as unknown as RegistroPonto);
            });

            const leftoverPontos = pontos?.filter(p => !usedPointIds.has(p.id.toString())) || [];
            leftoverPontos.forEach(p => {
                const user = users.find(u => u.id === p.usuario_id);
                mappedResults.push({ ...p, usuario: user || p.usuario });
            });

            const finalMapped: RegistroPonto[] = mappedResults as unknown as RegistroPonto[];
            return finalMapped.sort((a, b) => {
                const nomeA = a.usuario?.nome_completo?.toLowerCase() || "";
                const nomeB = b.usuario?.nome_completo?.toLowerCase() || "";
                if (nomeA !== nomeB) return nomeA.localeCompare(nomeB);
                return new Date(b.data_referencia).getTime() - new Date(a.data_referencia).getTime();
            });
        }

        let query = supabaseAdmin
            .from("registros_ponto")
            .select("*, cliente:clientes(nome_fantasia), colaborador_cliente:colaborador_clientes(unidade:unidades_cliente(nome_unidade)), usuario:usuarios!registros_ponto_usuario_id_fkey!inner(*, links:colaborador_clientes(cliente:clientes(nome_fantasia), unidade:unidades_cliente(nome_unidade))), pausas:registros_pausas(*)")
            .order("data_referencia", { ascending: false });

        if (filtros?.data_referencia) query = query.eq("data_referencia", filtros.data_referencia);

        if (filtros?.usuario_id && filtros.usuario_id !== FilterOptions.TODOS) query = query.eq("usuario_id", filtros.usuario_id);

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

    async getPontoHoje(usuarioId: string): Promise<RegistroPonto | null> {
        const hoje = toLocalDateString(new Date(getNowBR()));
        const { data, error } = await supabaseAdmin
            .from("registros_ponto")
            .select("*, cliente:clientes(*), pausas:registros_pausas(*)")
            .eq("usuario_id", usuarioId)
            .eq("data_referencia", hoje)
            .order("entrada_hora", { ascending: false })
            .limit(1);

        if (error) throw error;
        return formatPoint(data?.[0] as unknown as RegistroPonto) || null;
    },

    async togglePonto(usuarioId: string, location?: PontoLocation, km?: number, clienteId?: number, empresaId?: number, colaboradorClienteId?: number): Promise<{ action: 'OPEN' | 'CLOSE', record: RegistroPonto }> {
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

    async iniciarPausa(data: PausaPayload): Promise<Pausa> {
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
        const loc = processLocationData(data.inicio_loc);

        const { data: inserted, error } = await supabaseAdmin
            .from("registros_pausas")
            .insert([{
                ponto_id: data.ponto_id,
                inicio_hora,
                inicio_km: data.inicio_km,
                inicio_loc: loc,
                inicio_lat: loc.lat,
                inicio_lng: loc.lng,
                inicio_metadata: { accuracy: loc.accuracy, address: loc.address, device: data.inicio_loc?.device },
                distancia_trabalho: distanciaTrabalho
            }])
            .select()
            .single();

        if (error) throw error;
        const insertedRec = inserted;
        if (insertedRec) {
            insertedRec.inicio_hora = toBRTime(insertedRec.inicio_hora);
            if (insertedRec.fim_hora) insertedRec.fim_hora = toBRTime(insertedRec.fim_hora);
            if (insertedRec.ponto_id) await this.updatePonto(insertedRec.ponto_id, { force_recalculate: true });
        }
        return insertedRec;
    },

    async finalizarPausa(id: number, data: Partial<PausaPayload>): Promise<Pausa> {
        const fim_hora = data.fim_hora ? toBRTime(data.fim_hora) : getNowBR();
        const { data: currentPausa } = await supabaseAdmin.from("registros_pausas").select("inicio_km, ponto_id").eq("id", id).single();
        if (!currentPausa) throw new AppError(messages.ponto.erro.pausaNaoEncontrada, 404);

        const distanciaPausa = (data.fim_km && currentPausa.inicio_km) ? Math.max(0, data.fim_km - currentPausa.inicio_km) : 0;
        const loc = processLocationData(data.fim_loc);

        const { data: updated, error } = await supabaseAdmin
            .from("registros_pausas")
            .update({
                fim_hora,
                fim_km: data.fim_km,
                fim_loc: loc,
                fim_lat: loc.lat,
                fim_lng: loc.lng,
                fim_metadata: { accuracy: loc.accuracy, address: loc.address, device: data.fim_loc?.device },
                distancia_pausa: distanciaPausa
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        const result = updated;
        if (result) {
            result.inicio_hora = toBRTime(result.inicio_hora);
            if (result.fim_hora) result.fim_hora = toBRTime(result.fim_hora);
            if (result.ponto_id) await this.updatePonto(result.ponto_id, { force_recalculate: true });
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

    async getRelatorioMensal(usuarioId: string, mes: number, ano: number): Promise<unknown[]> {
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
