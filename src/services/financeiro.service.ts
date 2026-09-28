import { supabaseAdmin } from "../config/supabase.js";
import { FINANCEIRO_STATUS, LANCAMENTO_TIPO, CALENDARIO_STATUS } from "../constants/financeiro.enum.js";
import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";
import { ROLES } from "../constants/permissions.enum.js";
import { getNowBR, toBRTime, toLocalDateString, extractDateOnly } from "../utils/utils.js";
import { ocorrenciaService } from "./ocorrencia.service.js";

import { ExtratoMensal, FechamentoPayload, ConfirmacaoAdiantamentoPayload, StatusGeralFechamento, DashboardLoteResultado } from "../types/financeiro.type.js";
import { Ocorrencia } from "../types/database.js";

interface ConfirmacaoAdiantamentoDb {
    id: number;
    colaborador_id: string;
    mes: number;
    ano: number;
    valor?: number | null;
    confirmado_por: string;
    data_confirmacao: string;
}

interface FechamentoFinanceiroDb {
    id: number;
    colaborador_id: string;
    mes: number;
    ano: number;
    saldo_final: number;
    fechado_por: string;
    data_fechamento: string;
    pago: boolean;
    data_pagamento: string;
}

interface ColaboradorClienteDb {
    colaborador_id: string;
    valor_adiantamento: number | null;
    data_fim: string | null;
    cliente: {
        nome_fantasia: string;
    }[] | null;
}

function formatFechamento<T extends { data_fechamento?: string; data_pagamento?: string; created_at?: string }>(f: T): T {
    if (!f) return f;
    const result = { ...f };
    if (result.data_fechamento) result.data_fechamento = toBRTime(result.data_fechamento);
    if (result.data_pagamento) result.data_pagamento = toBRTime(result.data_pagamento);
    if (result.created_at) result.created_at = toBRTime(result.created_at);
    return result;
}

interface DashboardLoteCacheItem {
    timestamp: number;
    data: {
        totalFolha: number;
        valorPago: number;
        restaPagar: number;
        pendentesCount: number;
    };
}

const dashboardLoteCache = new Map<string, DashboardLoteCacheItem>();
const DASHBOARD_CACHE_TTL_MS = 60 * 1000;

export function invalidateDashboardLoteCache(mes?: number, ano?: number) {
    if (mes && ano) {
        dashboardLoteCache.delete(`${mes}-${ano}`);
    } else {
        dashboardLoteCache.clear();
    }
}

// GAMBIARRA TEMPORARIA - COMPROVACAO DE RENDA (REMOVER AMANHA)
const GAMBIARRA_USER_ID = "ec6c085a-35cf-4422-a41f-e97f5c6ed7e1";

function aplicarGambiarraSemDescontos(extrato: ExtratoMensal): ExtratoMensal {
    let totalTurnos = 0;
    const resumoPorCliente = (extrato.resumo_por_cliente || []).map(r => {
        const baseFixa = (r.valores_fixos?.contrato || 0) + (r.valores_fixos?.ajuda_custo || 0) + (r.valores_fixos?.aluguel || 0);
        const valorSemDesconto = parseFloat(baseFixa.toFixed(2));
        totalTurnos += valorSemDesconto;

        return {
            ...r,
            ausencias: 0,
            datas_ausencia: [],
            dias_esperados_turno: r.dias_base_mes || r.dias_esperados_turno,
            dias_trabalhados: r.dias_base_mes || r.dias_esperados_turno,
            debitos_ocorrencia: 0,
            creditos_ocorrencia: 0,
            valor_calculado: valorSemDesconto,
            saldo_fixo_original: valorSemDesconto,
            valores_fixos: {
                ...r.valores_fixos,
                bonus: 0,
                bonus_config: 0,
                adiantamento: 0,
                adiantamento_config: 0
            },
            calendario_visual: (r.calendario_visual || []).map(c => ({
                ...c,
                status: (c.status === 'SEM_ATIVIDADE' ? 'TRABALHADO' : c.status) as any
            }))
        };
    });

    const saldoFinal = parseFloat(totalTurnos.toFixed(2));

    return {
        ...extrato,
        resumo_por_cliente: resumoPorCliente,
        ocorrencias: [],
        ocorrencias_avulsas: { creditos: 0, debitos: 0, saldo: 0 },
        lancamentos_convenios: [],
        mei_consolidado: {
            valor_original: 0,
            valor_calculado: 0,
            dias_base: extrato.mei_consolidado?.dias_base || 26,
            dias_trabalhados: extrato.mei_consolidado?.dias_base || 26,
            datas_trabalhadas: []
        },
        totais: {
            total_turnos: saldoFinal,
            total_mei: 0,
            total_avulso: 0,
            total_adiantamento: 0,
            saldo_final: saldoFinal
        }
    };
}

export const financeiroService = {
    _calcularMatematicaExtrato(dados: {
        usuarioId: string;
        mes: number;
        ano: number;
        usuario: { valor_mei: number | null } | null;
        links: any[];
        ocorrencias: Ocorrencia[];
        fechamentoAnterior: { saldo_final: number } | null;
        pontos: any[];
        feriadosMes: Set<string>;
        confirmacaoAdiantamento: any | null;
        lancamentosConvenios: any[];
    }): ExtratoMensal {
        const { usuarioId, mes, ano, usuario, links, ocorrencias, fechamentoAnterior, pontos, feriadosMes, confirmacaoAdiantamento, lancamentosConvenios } = dados;

        const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dataInicioMesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFimMesStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

        let mesAnterior = mes - 1;
        let anoAnterior = ano;
        if (mesAnterior === 0) {
            mesAnterior = 12;
            anoAnterior = ano - 1;
        }

        if (fechamentoAnterior && fechamentoAnterior.saldo_final < 0) {
            const valorDebito = Math.abs(fechamentoAnterior.saldo_final);
            ocorrencias.push({
                is_virtual: true,
                colaborador_id: usuarioId,
                tipo_id: 0,
                data_ocorrencia: dataInicioMesStr,
                valor: valorDebito,
                impacto_financeiro: true,
                tipo_lancamento: LANCAMENTO_TIPO.SAIDA,
                observacao: `Saldo devedor acumulado de ${String(mesAnterior).padStart(2, '0')}/${anoAnterior}`,
                tipo: { descricao: "Saldo Devedor (Mês Anterior)" }
            } as Ocorrencia);
        }

        const adiantamentoConfirmado = !!confirmacaoAdiantamento;
        const valorAdiantamentoCustom = (typeof confirmacaoAdiantamento === 'object' && confirmacaoAdiantamento !== null && 'valor' in confirmacaoAdiantamento && confirmacaoAdiantamento.valor !== null && confirmacaoAdiantamento.valor !== undefined)
            ? Number(confirmacaoAdiantamento.valor)
            : null;

        const linksAtivos = (links || []).filter(link => !link.data_fim);
        const somaAdiantamentoConfigurado = linksAtivos.reduce((acc, link) => acc + (link.valor_adiantamento || 0), 0);
        let valorAdiantamentoDistribuidoAcumulado = 0;

        const hojeLocalStr = toLocalDateString();

        const resumoClientes = (links || []).map(link => {
            const dataInicioStr = extractDateOnly(link.data_inicio) || extractDateOnly(link.created_at);
            const dataFimStr = extractDateOnly(link.data_fim);

            const isShiftInMonth = (!dataInicioStr || dataInicioStr <= dataFimMesStr) && (!dataFimStr || dataFimStr >= dataInicioMesStr);
            const pontosDesteTurnoRaw = (pontos || []).filter(p => p.colaborador_cliente_id === link.id);
            if (!isShiftInMonth && pontosDesteTurnoRaw.length === 0) {
                return null;
            }

            let diasEscalaNoMesTotal = 0;
            let diasEsperadosTurno = 0;
            let ausenciasTurno = 0;
            const calendarioVisual: any[] = [];

            for (let d = 1; d <= ultimoDiaMes; d++) {
                const dataAtual = new Date(Date.UTC(ano, mes - 1, d));
                const dataReferenciaStr = dataAtual.toISOString().split('T')[0];
                const diaSemana = dataAtual.getUTCDay();

                const isDiaEscala = (link as any).horarios && (link as any).horarios.some((h: any) => h.dia_semana === diaSemana);
                const isVigente = (!dataInicioStr || dataReferenciaStr >= dataInicioStr) && (!dataFimStr || dataReferenciaStr <= dataFimStr);
                const isFuturoOuHoje = dataReferenciaStr >= hojeLocalStr;

                if (isDiaEscala) {
                    diasEscalaNoMesTotal++;
                    if (isVigente) diasEsperadosTurno++;
                }

                let status: string = CALENDARIO_STATUS.NAO_VIGENTE;
                if (isVigente) {
                    const temPonto = (pontos || []).some(p => p.data_referencia === dataReferenciaStr && p.colaborador_cliente_id === link.id);
                    const isFeriado = feriadosMes.has(dataReferenciaStr);

                    if (temPonto) {
                        status = CALENDARIO_STATUS.TRABALHADO;
                    } else if (isFuturoOuHoje) {
                        status = CALENDARIO_STATUS.FUTURO;
                    } else if (isDiaEscala) {
                        if (isFeriado) {
                            status = CALENDARIO_STATUS.FERIADO;
                        } else {
                            status = CALENDARIO_STATUS.SEM_ATIVIDADE;
                            ausenciasTurno++;
                        }
                    } else {
                        status = CALENDARIO_STATUS.NAO_VIGENTE;
                    }
                }

                if (isDiaEscala) {
                    const diasSemanaNomes = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
                    const diasSemanaNomesLongos = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

                    calendarioVisual.push({
                        data: dataReferenciaStr,
                        data_br: dataReferenciaStr.split('-').reverse().join('/'),
                        dia: d,
                        dia_semana_curto: diasSemanaNomes[diaSemana],
                        dia_semana_longo: diasSemanaNomesLongos[diaSemana],
                        status,
                        is_dia_escala: isDiaEscala
                    });
                }
            }

            if (diasEscalaNoMesTotal === 0) return null;
            if (diasEsperadosTurno === 0 && pontosDesteTurnoRaw.length === 0) return null;

            const pontosDesteTurno = (pontos || []).filter(p => {
                if (p.colaborador_cliente_id !== link.id) return false;
                if (dataInicioStr && p.data_referencia < dataInicioStr) return false;
                if (dataFimStr && p.data_referencia > dataFimStr) return false;
                return true;
            });

            const diasTrabalhados = new Set(pontosDesteTurno.map(p => p.data_referencia)).size;

            const bonusEfetivo = (diasEsperadosTurno > 0 && ausenciasTurno === 0) ? (link.valor_bonus || 0) : 0;
            const isAtivo = !link.data_fim;
            const valorAdiantamentoConfig = isAtivo ? (link.valor_adiantamento || 0) : 0;
            let valorAdiantamentoEfetivo = 0;

            if (adiantamentoConfirmado) {
                if (valorAdiantamentoCustom !== null) {
                    if (isAtivo) {
                        const indexAtivo = linksAtivos.findIndex(l => l.id === link.id);
                        const isUltimoAtivo = indexAtivo === linksAtivos.length - 1;

                        if (somaAdiantamentoConfigurado > 0) {
                            if (isUltimoAtivo) {
                                valorAdiantamentoEfetivo = Math.max(0, parseFloat((valorAdiantamentoCustom - valorAdiantamentoDistribuidoAcumulado).toFixed(2)));
                            } else {
                                const proporcao = valorAdiantamentoConfig / somaAdiantamentoConfigurado;
                                valorAdiantamentoEfetivo = parseFloat((valorAdiantamentoCustom * proporcao).toFixed(2));
                                valorAdiantamentoDistribuidoAcumulado += valorAdiantamentoEfetivo;
                            }
                        } else {
                            if (indexAtivo === 0) {
                                valorAdiantamentoEfetivo = valorAdiantamentoCustom;
                            } else {
                                valorAdiantamentoEfetivo = 0;
                            }
                        }
                    }
                } else {
                    valorAdiantamentoEfetivo = valorAdiantamentoConfig;
                }
            }


            const baseBrutaFixa = (link.valor_contrato || 0) + (link.ajuda_custo || 0) + (link.valor_aluguel || 0);
            const diasParaPagamento = Math.max(0, diasEsperadosTurno - ausenciasTurno);
            const valorCalculadoProRata = (baseBrutaFixa / diasEscalaNoMesTotal) * diasParaPagamento;
            const valorFinalComBonus = valorCalculadoProRata - valorAdiantamentoEfetivo + bonusEfetivo;

            const valorDia = baseBrutaFixa / diasEscalaNoMesTotal;
            const virtualOcorrenciasTurno: Ocorrencia[] = [];
            const datasAusencia: string[] = [];

            calendarioVisual.forEach(dia => {
                if (dia.status === CALENDARIO_STATUS.SEM_ATIVIDADE) {
                    datasAusencia.push(dia.data);
                    virtualOcorrenciasTurno.push({
                        is_virtual: true,
                        colaborador_id: usuarioId,
                        colaborador_cliente_id: link.id,
                        tipo_id: 0,
                        data_ocorrencia: dia.data,
                        valor: parseFloat(valorDia.toFixed(2)),
                        impacto_financeiro: true,
                        tipo_lancamento: LANCAMENTO_TIPO.SAIDA,
                        observacao: `Sem Atividade - ${dia.dia_semana_curto}`,
                        tipo: { descricao: "Sem Atividade" }
                    });
                }
            });

            if (valorAdiantamentoEfetivo > 0) {
                virtualOcorrenciasTurno.push({
                    is_virtual: true,
                    colaborador_id: usuarioId,
                    colaborador_cliente_id: link.id,
                    tipo_id: 0,
                    data_ocorrencia: dataFimMesStr,
                    valor: valorAdiantamentoEfetivo,
                    impacto_financeiro: true,
                    tipo_lancamento: LANCAMENTO_TIPO.SAIDA,
                    observacao: "Adiantamento Mensal",
                    tipo: { descricao: "Adiantamento" }
                });
            }

            const todasOcorrenciasTurno = [
                ...ocorrencias.filter(o => o.colaborador_cliente_id === link.id && o.impacto_financeiro),
                ...virtualOcorrenciasTurno
            ];

            const totalCreditosTurno = todasOcorrenciasTurno.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.ENTRADA).reduce((acc, o) => acc + (o.valor || 0), 0);
            const totalDebitosTurno = todasOcorrenciasTurno.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.SAIDA).reduce((acc, o) => acc + (o.valor || 0), 0);

            // O valor calculado agora parte da base proporcional ao período vigente (data_inicio e data_fim),
            // e então somamos bônus/créditos e deduzimos os débitos (que já incluem as ausências como deduções virtuais).
            const valorBrutoVigente = (baseBrutaFixa / diasEscalaNoMesTotal) * diasEsperadosTurno;
            const valorFinalCalculado = valorBrutoVigente + bonusEfetivo + totalCreditosTurno - totalDebitosTurno;

            return {
                cliente_id: link.cliente_id,
                unidade_id: link.unidade_id,
                nome_fantasia: link.cliente?.nome_fantasia,
                nome_unidade: link.unidade?.nome_unidade,
                id_vinculo: link.id,
                saldo_fixo_original: baseBrutaFixa - valorAdiantamentoEfetivo + bonusEfetivo,
                valores_fixos: {
                    contrato: link.valor_contrato || 0,
                    bonus: bonusEfetivo,
                    bonus_config: link.valor_bonus || 0,
                    ajuda_custo: link.ajuda_custo || 0,
                    aluguel: link.valor_aluguel || 0,
                    adiantamento: valorAdiantamentoEfetivo,
                    adiantamento_config: valorAdiantamentoConfig,
                    taxa_entrega: link.taxa_entrega || 0
                },
                dias_base_mes: diasEscalaNoMesTotal,
                dias_esperados_turno: diasEsperadosTurno,
                dias_trabalhados: diasTrabalhados,
                ausencias: ausenciasTurno,
                calendario_visual: calendarioVisual,
                data_inicio: link.data_inicio || null,
                data_fim: link.data_fim || null,
                creditos_ocorrencia: totalCreditosTurno,
                debitos_ocorrencia: totalDebitosTurno,
                valor_calculado: parseFloat(valorFinalCalculado.toFixed(2)),
                datas_ausencia: datasAusencia,
                _virtual_ocorrencias: virtualOcorrenciasTurno
            };
        }).filter((r): r is Exclude<typeof r, null> => r !== null);

        const ocorrenciasComFeriadoMarcado = (ocorrencias || []).map(o => {
            const ehAutomática = o.observacao?.includes("Inclusão automática:");
            if (ehAutomática) return { ...o, is_virtual: true };
            return o;
        });

        const virtualOcorrenciasGlobais = resumoClientes.flatMap(r => (r as any)._virtual_ocorrencias || []);
        const todasOcorrencias = [...ocorrenciasComFeriadoMarcado, ...virtualOcorrenciasGlobais].sort((a, b) => b.data_ocorrencia.localeCompare(a.data_ocorrencia));

        resumoClientes.forEach(r => delete (r as any)._virtual_ocorrencias);

        const valorMeiTotal = usuario?.valor_mei || 0;
        let proRataMeiFinal = 0;
        let diasAtivosUnicos: string[] = [];
        let diasBaseReferencia = 26;

        if (valorMeiTotal > 0) {
            const datasComPonto = [...new Set((pontos || []).map(p => p.data_referencia))];

            const datasEscalaEsperada = new Set<string>();
            resumoClientes.forEach(r => {
                r.calendario_visual.forEach((dia: any) => {
                    if (dia.is_dia_escala && dia.status !== CALENDARIO_STATUS.NAO_VIGENTE) {
                        datasEscalaEsperada.add(dia.data);
                    }
                });
            });

            if (resumoClientes.length > 0) {
                diasBaseReferencia = resumoClientes[0].dias_base_mes;
            }

            const diasParaCobrancaMei = datasEscalaEsperada.size;
            proRataMeiFinal = (valorMeiTotal / diasBaseReferencia) * diasParaCobrancaMei;

            if (proRataMeiFinal > valorMeiTotal) proRataMeiFinal = valorMeiTotal;

            diasAtivosUnicos = datasComPonto.sort();
        }

        const ocorrenciasAvulsas = ocorrencias.filter(o => !o.colaborador_cliente_id && o.impacto_financeiro);
        const creditosAvulsos = ocorrenciasAvulsas.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.ENTRADA).reduce((acc, o) => acc + (o.valor || 0), 0);
        const debitosAvulsos = ocorrenciasAvulsas.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.SAIDA).reduce((acc, o) => acc + (o.valor || 0), 0);
        const saldoAvulso = creditosAvulsos - debitosAvulsos;

        const totalTurnos = resumoClientes.reduce((acc, r) => acc + (r.valor_calculado || 0), 0);
        const totalAdiantamento = adiantamentoConfirmado
            ? (valorAdiantamentoCustom !== null
                ? valorAdiantamentoCustom
                : resumoClientes.reduce((acc, r) => acc + (r.valores_fixos.adiantamento || 0), 0))
            : 0;
        const debitosConvenios = (lancamentosConvenios || []).reduce((acc, l) => acc + (l.valor || 0), 0);
        const saldoFinal = totalTurnos + proRataMeiFinal + saldoAvulso - debitosConvenios;


        return {
            periodo: { mes, ano },
            status: FINANCEIRO_STATUS.RASCUNHO,
            adiantamento_confirmado: adiantamentoConfirmado,
            resumo_por_cliente: resumoClientes,
            mei_consolidado: {
                valor_original: valorMeiTotal,
                valor_calculado: parseFloat(proRataMeiFinal.toFixed(2)),
                dias_base: diasBaseReferencia,
                dias_trabalhados: diasAtivosUnicos.length,
                datas_trabalhadas: diasAtivosUnicos
            },
            ocorrencias: todasOcorrencias,
            ocorrencias_avulsas: {
                creditos: creditosAvulsos,
                debitos: debitosAvulsos,
                saldo: parseFloat(saldoAvulso.toFixed(2))
            },
            lancamentos_convenios: lancamentosConvenios,
            totais: {
                total_turnos: parseFloat(totalTurnos.toFixed(2)),
                total_mei: parseFloat(proRataMeiFinal.toFixed(2)),
                total_avulso: parseFloat(saldoAvulso.toFixed(2)),
                total_adiantamento: totalAdiantamento,
                saldo_final: parseFloat(saldoFinal.toFixed(2))
            }
        };
    },

    /**
     * Gera o extrato financeiro mensal de um colaborador.
     * Consolida ganhos (contrato), descontos (adiantamento, ocorrências) e ajustes (pro-rata).
     */
    async getExtratoMensal(usuarioId: string, mes: number, ano: number): Promise<ExtratoMensal> {
        const { data: fechamentoExistente } = await supabaseAdmin
            .from("fechamentos_financeiros")
            .select("*")
            .eq("colaborador_id", usuarioId)
            .eq("mes", mes)
            .eq("ano", ano)
            .maybeSingle();

        if (fechamentoExistente) {
            const resultadoPago: ExtratoMensal = {
                ...(fechamentoExistente.resumo_json as ExtratoMensal),
                status: FINANCEIRO_STATUS.PAGO,
                id_fechamento: fechamentoExistente.id,
                data_pagamento: toBRTime(fechamentoExistente.data_pagamento)
            };
            if (usuarioId === GAMBIARRA_USER_ID) {
                return aplicarGambiarraSemDescontos(resultadoPago);
            }
            return resultadoPago;
        }

        const { data: usuario, error: userError } = await supabaseAdmin
            .from("usuarios")
            .select("valor_mei")
            .eq("id", usuarioId)
            .single();

        if (userError) throw userError;

        const { data: links, error: linkError } = await supabaseAdmin
            .from("colaborador_clientes")
            .select("*, cliente:clientes(*), unidade:unidades_cliente(*), horarios:colaborador_cliente_horarios(*)")
            .eq("colaborador_id", usuarioId);

        if (linkError) throw linkError;

        const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dataInicioMesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFimMesStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

        const ocorrencias = await ocorrenciaService.listOcorrencias({ usuario_id: usuarioId, data_inicio: dataInicioMesStr, data_fim: dataFimMesStr });

        let mesAnterior = mes - 1;
        let anoAnterior = ano;
        if (mesAnterior === 0) {
            mesAnterior = 12;
            anoAnterior = ano - 1;
        }

        const { data: fechamentoAnterior } = await supabaseAdmin
            .from("fechamentos_financeiros")
            .select("saldo_final")
            .eq("colaborador_id", usuarioId)
            .eq("mes", mesAnterior)
            .eq("ano", anoAnterior)
            .eq("pago", true)
            .maybeSingle();

        const { data: pontos } = await supabaseAdmin
            .from("registros_ponto")
            .select("*")
            .eq("usuario_id", usuarioId)
            .gte("data_referencia", dataInicioMesStr)
            .lte("data_referencia", dataFimMesStr);

        const { data: feriadosData } = await supabaseAdmin
            .from("feriados")
            .select("data")
            .gte("data", dataInicioMesStr)
            .lte("data", dataFimMesStr);
        const feriadosMes = new Set((feriadosData || []).map(f => f.data));

        const { data: confirmacaoAdiantamento } = await supabaseAdmin
            .from("confirmacoes_adiantamento")
            .select("*")
            .eq("colaborador_id", usuarioId)
            .eq("mes", mes)
            .eq("ano", ano)
            .maybeSingle();

        const { data: lancamentosConvenios } = await supabaseAdmin
            .from("lancamentos_convenios")
            .select("*, convenio:convenios(nome)")
            .eq("colaborador_id", usuarioId)
            .eq("moto_embu", false)
            .gte("data_lancamento", dataInicioMesStr)
            .lte("data_lancamento", dataFimMesStr);

        const extratoCalculado = this._calcularMatematicaExtrato({
            usuarioId,
            mes,
            ano,
            usuario,
            links: links || [],
            ocorrencias: ocorrencias || [],
            fechamentoAnterior,
            pontos: pontos || [],
            feriadosMes,
            confirmacaoAdiantamento,
            lancamentosConvenios: lancamentosConvenios || []
        });

        if (usuarioId === GAMBIARRA_USER_ID) {
            return aplicarGambiarraSemDescontos(extratoCalculado);
        }

        return extratoCalculado;
    },

    /**
     * Calcula dados agregados do dashboard financeiro para todos os colaboradores no mes/ano em lote.
     */
    async getDashboardLote(mes: number, ano: number) {
        const cacheKey = `${mes}-${ano}`;
        const cached = dashboardLoteCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < DASHBOARD_CACHE_TTL_MS) {
            return cached.data;
        }

        const { data: perfilMotoboy } = await supabaseAdmin
            .from("perfis")
            .select("id")
            .ilike("nome", ROLES.MOTOBOY)
            .maybeSingle();

        const perfilMotoboyId = perfilMotoboy?.id || 3;

        const { data: colaboradoresAtivos } = await supabaseAdmin
            .from("usuarios")
            .select("id, valor_mei")
            .eq("status", CADASTRO_STATUS.ATIVO)
            .eq("perfil_id", perfilMotoboyId);

        const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dataInicioMesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFimMesStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

        if (!colaboradoresAtivos || colaboradoresAtivos.length === 0) {
            const emptyResult: DashboardLoteResultado = {
                totalFolha: 0,
                valorPago: 0,
                restaPagar: 0,
                pendentesCount: 0,
                pagosCount: 0,
                totalColaboradores: 0,
                totalFolhaBruta: 0,
                totalDescontoFaltas: 0,
                totalDescontoConvenios: 0,
                totalAdiantamentoPago: 0,
                totalAdiantamentoPrevisto: 0,
                colaboradoresAdiantamentoCount: 0,
                saldoFinalFolha: 0
            };
            dashboardLoteCache.set(cacheKey, { timestamp: Date.now(), data: emptyResult });
            return emptyResult;
        }

        const [fechamentosRes, todosTurnosRes, todasConfirmacoesRes] = await Promise.all([
            supabaseAdmin
                .from("fechamentos_financeiros")
                .select("colaborador_id, saldo_final, resumo_json")
                .eq("mes", mes)
                .eq("ano", ano)
                .eq("pago", true),
            supabaseAdmin
                .from("colaborador_clientes")
                .select("colaborador_id, valor_adiantamento, data_fim")
                .or(`data_fim.is.null,data_fim.gte.${dataInicioMesStr}`),
            supabaseAdmin
                .from("confirmacoes_adiantamento")
                .select("colaborador_id, valor")
                .eq("mes", mes)
                .eq("ano", ano)
        ]);

        const fechamentos = fechamentosRes.data || [];
        const todosTurnos = todosTurnosRes.data || [];
        const todasConfirmacoes = todasConfirmacoesRes.data || [];

        const totalAdiantamentoPrevisto = todosTurnos.reduce((acc, t) => acc + Number(t.valor_adiantamento || 0), 0);
        const colaboradoresAdiantamentoCount = todasConfirmacoes.length;

        const fechamentosMap = new Map();
        let valorPago = 0;
        let totalFolhaBruta = 0;
        let totalDescontoFaltas = 0;
        let totalDescontoConvenios = 0;
        let totalAdiantamentoPago = 0;

        function extrairComponentes(r: any) {
            let colabBruto = 0;
            let colabFaltas = 0;
            let colabAdi = 0;

            (r.resumo_por_cliente || []).forEach((c: any) => {
                const v = c.valores_fixos || {};
                const baseBrutaFixa = Number(v.contrato || 0) + Number(v.ajuda_custo || 0) + Number(v.aluguel || 0);
                const diasBase = Number(c.dias_base_mes) || 26;
                const diasEsperados = Number(c.dias_esperados_turno) || diasBase;
                const brutoVigente = (baseBrutaFixa / diasBase) * diasEsperados;
                colabBruto += brutoVigente + Number(v.bonus || 0) + Number(c.creditos_ocorrencia || 0);

                const adi = Number(v.adiantamento || 0);
                colabAdi += adi;
                const ausencias = Math.max(0, Number(c.debitos_ocorrencia || 0) - adi);
                colabFaltas += ausencias;
            });

            const mei = Number(r.mei_consolidado?.valor_calculado || 0);
            const credAvulso = Number(r.ocorrencias_avulsas?.creditos || 0);
            const debAvulso = Number(r.ocorrencias_avulsas?.debitos || 0);
            const conv = (r.lancamentos_convenios || []).reduce((acc: number, l: any) => acc + Number(l.valor || 0), 0);

            return {
                bruto: colabBruto + mei + credAvulso,
                faltas: colabFaltas + debAvulso,
                convenios: conv,
                adiantamentoPago: colabAdi
            };
        }

        fechamentos.forEach(f => {
            fechamentosMap.set(f.colaborador_id, f);
            valorPago += Number(f.saldo_final || 0);

            const r = f.resumo_json as any;
            if (r) {
                const comp = extrairComponentes(r);
                totalFolhaBruta += comp.bruto;
                totalDescontoFaltas += comp.faltas;
                totalDescontoConvenios += comp.convenios;
                totalAdiantamentoPago += comp.adiantamentoPago;
            }
        });

        const pendentes = colaboradoresAtivos.filter(c => !fechamentosMap.has(c.id));

        if (pendentes.length === 0) {
            const totalDescontosTotalPaid = totalDescontoFaltas + totalDescontoConvenios;
            const folhaBrutaReconciliadaPaid = valorPago + totalDescontosTotalPaid + totalAdiantamentoPago;

            const allPaidResult: DashboardLoteResultado = {
                totalFolha: parseFloat(valorPago.toFixed(2)),
                valorPago: parseFloat(valorPago.toFixed(2)),
                restaPagar: 0,
                pendentesCount: 0,
                pagosCount: fechamentos.length,
                totalColaboradores: fechamentos.length,
                totalFolhaBruta: parseFloat(folhaBrutaReconciliadaPaid.toFixed(2)),
                totalDescontoFaltas: parseFloat(totalDescontoFaltas.toFixed(2)),
                totalDescontoConvenios: parseFloat(totalDescontoConvenios.toFixed(2)),
                totalAdiantamentoPago: parseFloat(totalAdiantamentoPago.toFixed(2)),
                totalAdiantamentoPrevisto: parseFloat(totalAdiantamentoPrevisto.toFixed(2)),
                colaboradoresAdiantamentoCount,
                saldoFinalFolha: parseFloat(valorPago.toFixed(2))
            };
            dashboardLoteCache.set(cacheKey, { timestamp: Date.now(), data: allPaidResult });
            return allPaidResult;
        }

        const pendentesIds = pendentes.map(p => p.id);

        let mesAnterior = mes - 1;
        let anoAnterior = ano;
        if (mesAnterior === 0) { mesAnterior = 12; anoAnterior = ano - 1; }

        const CHUNK_SIZE = 50;
        const chunks: string[][] = [];
        for (let i = 0; i < pendentesIds.length; i += CHUNK_SIZE) {
            chunks.push(pendentesIds.slice(i, i + CHUNK_SIZE));
        }

        const linksPorUsuario = new Map();
        const ocorrenciasPorUsuario = new Map();
        const fechamentosAnterioresMap = new Map();
        const pontosPorUsuario = new Map();
        const confirmacoesMap = new Map<string, ConfirmacaoAdiantamentoDb>();
        const conveniosPorUsuario = new Map();

        const [feriadosRes] = await Promise.all([
            supabaseAdmin
                .from("feriados")
                .select("data")
                .gte("data", dataInicioMesStr)
                .lte("data", dataFimMesStr),
            ...chunks.map(async (chunkIds) => {
                const [
                    linksRes,
                    ocorrenciasRes,
                    fechamentosAntRes,
                    pontosRes,
                    confirmacoesRes,
                    conveniosRes
                ] = await Promise.all([
                    supabaseAdmin
                        .from("colaborador_clientes")
                        .select("*, cliente:clientes(*), unidade:unidades_cliente(*), horarios:colaborador_cliente_horarios(*)")
                        .in("colaborador_id", chunkIds),
                    supabaseAdmin
                        .from("ocorrencias")
                        .select("*, tipo:tipos_ocorrencia(id, descricao)")
                        .in("colaborador_id", chunkIds)
                        .gte("data_ocorrencia", dataInicioMesStr)
                        .lte("data_ocorrencia", dataFimMesStr),
                    supabaseAdmin
                        .from("fechamentos_financeiros")
                        .select("colaborador_id, saldo_final")
                        .in("colaborador_id", chunkIds)
                        .eq("mes", mesAnterior)
                        .eq("ano", anoAnterior)
                        .eq("pago", true),
                    supabaseAdmin
                        .from("registros_ponto")
                        .select("*")
                        .in("usuario_id", chunkIds)
                        .gte("data_referencia", dataInicioMesStr)
                        .lte("data_referencia", dataFimMesStr),
                    supabaseAdmin
                        .from("confirmacoes_adiantamento")
                        .select("*")
                        .in("colaborador_id", chunkIds)
                        .eq("mes", mes)
                        .eq("ano", ano),
                    supabaseAdmin
                        .from("lancamentos_convenios")
                        .select("*, convenio:convenios(nome)")
                        .in("colaborador_id", chunkIds)
                        .eq("moto_embu", false)
                        .gte("data_lancamento", dataInicioMesStr)
                        .lte("data_lancamento", dataFimMesStr)
                ]);

                (linksRes.data || []).forEach(l => {
                    if (!linksPorUsuario.has(l.colaborador_id)) linksPorUsuario.set(l.colaborador_id, []);
                    linksPorUsuario.get(l.colaborador_id).push(l);
                });

                (ocorrenciasRes.data || []).forEach(o => {
                    if (!ocorrenciasPorUsuario.has(o.colaborador_id)) ocorrenciasPorUsuario.set(o.colaborador_id, []);
                    ocorrenciasPorUsuario.get(o.colaborador_id).push(o);
                });

                (fechamentosAntRes.data || []).forEach(f => {
                    fechamentosAnterioresMap.set(f.colaborador_id, f);
                });

                (pontosRes.data || []).forEach(p => {
                    if (!pontosPorUsuario.has(p.usuario_id)) pontosPorUsuario.set(p.usuario_id, []);
                    pontosPorUsuario.get(p.usuario_id).push(p);
                });

                (confirmacoesRes.data as ConfirmacaoAdiantamentoDb[] || []).forEach(c => {
                    confirmacoesMap.set(c.colaborador_id, c);
                });

                (conveniosRes.data || []).forEach(l => {
                    if (!conveniosPorUsuario.has(l.colaborador_id)) conveniosPorUsuario.set(l.colaborador_id, []);
                    conveniosPorUsuario.get(l.colaborador_id).push(l);
                });
            })
        ]);

        const feriadosMes = new Set((feriadosRes.data || []).map(f => f.data));

        let restaPagar = 0;

        pendentes.forEach(usuario => {
            const extrato = this._calcularMatematicaExtrato({
                usuarioId: usuario.id,
                mes,
                ano,
                usuario,
                links: linksPorUsuario.get(usuario.id) || [],
                ocorrencias: ocorrenciasPorUsuario.get(usuario.id) || [],
                fechamentoAnterior: fechamentosAnterioresMap.get(usuario.id) || null,
                pontos: pontosPorUsuario.get(usuario.id) || [],
                feriadosMes,
                confirmacaoAdiantamento: confirmacoesMap.get(usuario.id) || null,
                lancamentosConvenios: conveniosPorUsuario.get(usuario.id) || []
            });

            const saldo = Number(extrato.totais.saldo_final || 0);
            restaPagar += saldo;

            const comp = extrairComponentes(extrato);
            totalFolhaBruta += comp.bruto;
            totalDescontoFaltas += comp.faltas;
            totalDescontoConvenios += comp.convenios;
            totalAdiantamentoPago += comp.adiantamentoPago;
        });

        const totalFolha = valorPago + restaPagar;
        const totalDescontosTotal = totalDescontoFaltas + totalDescontoConvenios;
        const folhaBrutaReconciliada = totalFolha + totalDescontosTotal + totalAdiantamentoPago;

        const resultadoFinal: DashboardLoteResultado = {
            totalFolha: parseFloat(totalFolha.toFixed(2)),
            valorPago: parseFloat(valorPago.toFixed(2)),
            restaPagar: parseFloat(restaPagar.toFixed(2)),
            pendentesCount: pendentes.length,
            pagosCount: fechamentos.length,
            totalColaboradores: fechamentos.length + pendentes.length,
            totalFolhaBruta: parseFloat(folhaBrutaReconciliada.toFixed(2)),
            totalDescontoFaltas: parseFloat(totalDescontoFaltas.toFixed(2)),
            totalDescontoConvenios: parseFloat(totalDescontoConvenios.toFixed(2)),
            totalAdiantamentoPago: parseFloat(totalAdiantamentoPago.toFixed(2)),
            totalAdiantamentoPrevisto: parseFloat(totalAdiantamentoPrevisto.toFixed(2)),
            colaboradoresAdiantamentoCount,
            saldoFinalFolha: parseFloat(totalFolha.toFixed(2))
        };

        dashboardLoteCache.set(cacheKey, { timestamp: Date.now(), data: resultadoFinal });

        return resultadoFinal;
    },


    /**
     * Efetua o fechamento e pagamento em uma única ação.
     * Gera o snapshot e marca como pago.
     */
    async processarPagamento(usuarioId: string, mes: number, ano: number, pagoPor: string): Promise<ExtratoMensal> {
        const extrato = await this.getExtratoMensal(usuarioId, mes, ano);

        const { data: existing } = await supabaseAdmin
            .from("fechamentos_financeiros")
            .select("id")
            .eq("colaborador_id", usuarioId)
            .eq("mes", mes)
            .eq("ano", ano)
            .maybeSingle();

        const payload: FechamentoPayload = {
            colaborador_id: usuarioId,
            mes,
            ano,
            resumo_json: extrato,
            saldo_final: extrato.totais.saldo_final,
            fechado_por: pagoPor,
            data_fechamento: getNowBR(),
            pago: true,
            data_pagamento: getNowBR()
        };

        if (existing) {
            payload.id = existing.id;
        }

        const { data, error } = await supabaseAdmin
            .from("fechamentos_financeiros")
            .upsert(payload)
            .select()
            .single();

        if (error) throw error;
        invalidateDashboardLoteCache(mes, ano);
        return formatFechamento(data);
    },

    /**
     * Confirma o pagamento do adiantamento para um colaborador no mês/ano.
     */
    async confirmarAdiantamento(usuarioId: string, mes: number, ano: number, confirmadoPor: string, valor?: number | null): Promise<boolean> {
        const { data: existing } = await supabaseAdmin
            .from("confirmacoes_adiantamento")
            .select("id")
            .eq("colaborador_id", usuarioId)
            .eq("mes", mes)
            .eq("ano", ano)
            .maybeSingle();

        const payload: ConfirmacaoAdiantamentoPayload = {
            colaborador_id: usuarioId,
            mes,
            ano,
            valor: valor !== undefined ? valor : null,
            confirmado_por: confirmadoPor,
            data_confirmacao: getNowBR()
        };

        if (existing) {
            payload.id = existing.id;
        }

        const { error } = await supabaseAdmin
            .from("confirmacoes_adiantamento")
            .upsert(payload)
            .select()
            .single();

        if (error) throw error;
        invalidateDashboardLoteCache(mes, ano);
        return true;
    },

    async desconfirmarAdiantamento(usuarioId: string, mes: number, ano: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("confirmacoes_adiantamento")
            .delete()
            .eq("colaborador_id", usuarioId)
            .eq("mes", mes)
            .eq("ano", ano);

        if (error) throw error;
        invalidateDashboardLoteCache(mes, ano);
    },

    async desfazerPagamento(usuarioId: string, mes: number, ano: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("fechamentos_financeiros")
            .delete()
            .eq("colaborador_id", usuarioId)
            .eq("mes", mes)
            .eq("ano", ano);

        if (error) throw error;
        invalidateDashboardLoteCache(mes, ano);
    },

    async getStatusGeral(mes: number, ano: number): Promise<StatusGeralFechamento[]> {
        const dataInicioMesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;

        const { data: perfilMotoboy } = await supabaseAdmin
            .from("perfis")
            .select("id")
            .ilike("nome", ROLES.MOTOBOY)
            .maybeSingle();

        const perfilMotoboyId = perfilMotoboy?.id || 3;

        const [colabRes, confirmacoesRes, fechamentosRes, turnosRes] = await Promise.all([
            supabaseAdmin
                .from("usuarios")
                .select("id, nome_completo, email, status")
                .eq("status", CADASTRO_STATUS.ATIVO)
                .eq("perfil_id", perfilMotoboyId)
                .order("nome_completo", { ascending: true }),
            supabaseAdmin
                .from("confirmacoes_adiantamento")
                .select("*")
                .eq("mes", mes)
                .eq("ano", ano),
            supabaseAdmin
                .from("fechamentos_financeiros")
                .select("*")
                .eq("mes", mes)
                .eq("ano", ano),
            supabaseAdmin
                .from("colaborador_clientes")
                .select("colaborador_id, valor_adiantamento, data_fim, cliente:clientes(nome_fantasia)")
                .or(`data_fim.is.null,data_fim.gte.${dataInicioMesStr}`)
        ]);

        if (colabRes.error) throw colabRes.error;
        if (confirmacoesRes.error) throw confirmacoesRes.error;
        if (fechamentosRes.error) throw fechamentosRes.error;
        if (turnosRes.error) throw turnosRes.error;

        const colaboradores = colabRes.data;
        const confirmacoes = confirmacoesRes.data;
        const fechamentos = fechamentosRes.data;
        const todosTurnos = turnosRes.data;

        const confirmacoesMap = new Map<string, ConfirmacaoAdiantamentoDb>();
        (confirmacoes as ConfirmacaoAdiantamentoDb[] || []).forEach(c => {
            confirmacoesMap.set(c.colaborador_id, c);
        });

        const fechamentosMap = new Map<string, FechamentoFinanceiroDb>();
        (fechamentos as FechamentoFinanceiroDb[] || []).forEach(f => {
            fechamentosMap.set(f.colaborador_id, f);
        });
        
        const turnosPorColab = new Map<string, ColaboradorClienteDb[]>();
        (todosTurnos as ColaboradorClienteDb[] || []).forEach(t => {
            if (!turnosPorColab.has(t.colaborador_id)) {
                turnosPorColab.set(t.colaborador_id, []);
            }
            turnosPorColab.get(t.colaborador_id)!.push(t);
        });

        return (colaboradores || []).map(colab => {
            const confirmacao = confirmacoesMap.get(colab.id);
            const fechamento = fechamentosMap.get(colab.id);
            const turnos = turnosPorColab.get(colab.id) || [];

            const adiantamentoConfirmado = !!confirmacao;
            const pago = !!fechamento;

            const valorAdiantamentoConfigurado = turnos
                .filter(t => !t.data_fim)
                .reduce((acc, t) => acc + (t.valor_adiantamento || 0), 0);

            const valorAdiantamentoConfirmado = confirmacao
                ? (confirmacao.valor !== null && confirmacao.valor !== undefined ? Number(confirmacao.valor) : valorAdiantamentoConfigurado)
                : null;

            const valorFinal = fechamento ? (fechamento.saldo_final || 0) : 0;

            const clientes = turnos
                .map(t => {
                    if (!t.cliente) return null;
                    if (Array.isArray(t.cliente)) {
                        return t.cliente[0]?.nome_fantasia;
                    }
                    return (t.cliente as any).nome_fantasia;
                })
                .filter((nome): nome is string => !!nome);
            const clientesUnicos = [...new Set(clientes)];

            return {
                colaborador_id: colab.id,
                nome_completo: colab.nome_completo || "",
                email: colab.email || "",
                adiantamento_confirmado: adiantamentoConfirmado,
                data_confirmacao_adiantamento: confirmacao ? toBRTime(confirmacao.data_confirmacao) : null,
                pago,
                data_pagamento: fechamento ? toBRTime(fechamento.data_pagamento) : null,
                valor_adiantamento_configurado: valorAdiantamentoConfigurado,
                valor_adiantamento_confirmado: valorAdiantamentoConfirmado,
                valor_final: parseFloat(valorFinal.toFixed(2)),
                clientes: clientesUnicos
            };
        });
    }
};

