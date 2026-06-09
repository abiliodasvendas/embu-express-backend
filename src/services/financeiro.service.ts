import { supabaseAdmin } from "../config/supabase.js";
import { FINANCEIRO_STATUS, LANCAMENTO_TIPO, CALENDARIO_STATUS } from "../constants/financeiro.enum.js";
import { getNowBR, toBRTime } from "../utils/utils.js";
import { ocorrenciaService } from "./ocorrencia.service.js";

import { ExtratoMensal, FechamentoPayload, ConfirmacaoAdiantamentoPayload, StatusGeralFechamento } from "../types/financeiro.type.js";
import { Ocorrencia } from "../types/database.js";

interface ConfirmacaoAdiantamentoDb {
    id: number;
    colaborador_id: string;
    mes: number;
    ano: number;
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

export const financeiroService = {
    /**
     * Motor matemático do extrato.
     */
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
    }): ExtratoMensal {
        const { usuarioId, mes, ano, usuario, links, ocorrencias, fechamentoAnterior, pontos, feriadosMes, confirmacaoAdiantamento } = dados;

        const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dataInicioMesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFimMesStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

        // 3. Verificação de Saldo Devedor do Mês Anterior
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

        const now = new Date();
        const hojeLocalStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
        const hojeInicioDia = new Date(hojeLocalStr + 'T00:00:00');

        const resumoClientes = (links || []).map(link => {
            const dataInicioTurno = link.data_inicio ? new Date(link.data_inicio + 'T00:00:00') : null;
            const dataFimTurno = link.data_fim ? new Date(link.data_fim + 'T23:59:59') : null;

            let diasEscalaNoMesTotal = 0;   // Base (Divisor)
            let diasEsperadosTurno = 0;     // Meta individual
            let ausenciasTurno = 0;            // Contador de ausencias passadas
            const calendarioVisual: any[] = [];

            // 1. Loop diário para análise de escala, vigência e status visual
            for (let d = 1; d <= ultimoDiaMes; d++) {
                const dataAtual = new Date(Date.UTC(ano, mes - 1, d));
                const dataReferenciaStr = dataAtual.toISOString().split('T')[0];
                const diaSemana = dataAtual.getUTCDay();

                const isDiaEscala = (link as any).horarios && (link as any).horarios.some((h: any) => h.dia_semana === diaSemana);
                const dtComparacao = new Date(dataReferenciaStr + 'T12:00:00');
                const isVigente = (!dataInicioTurno || dtComparacao >= dataInicioTurno) && (!dataFimTurno || dtComparacao <= dataFimTurno);
                const isFuturoOuHoje = dtComparacao >= hojeInicioDia;

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

            const pontosDesteTurno = (pontos || []).filter(p => {
                const dataPonto = new Date(p.data_referencia + 'T12:00:00');
                if (p.colaborador_cliente_id !== link.id) return false;
                if (dataInicioTurno && dataPonto < dataInicioTurno) return false;
                if (dataFimTurno && dataPonto > dataFimTurno) return false;
                return true;
            });

            const diasTrabalhados = new Set(pontosDesteTurno.map(p => p.data_referencia)).size;

            // 3. Regra de Bônus: Concede se não houve nenhuma ausência (Zero Falta)
            // Permite bônus completo mesmo iniciando no meio do mês, desde que não tenha faltas
            const bonusEfetivo = (diasEsperadosTurno > 0 && ausenciasTurno === 0) ? (link.valor_bonus || 0) : 0;
            const valorAdiantamentoConfig = link.valor_adiantamento || 0;
            const valorAdiantamentoEfetivo = adiantamentoConfirmado ? valorAdiantamentoConfig : 0;

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
        const totalAdiantamento = resumoClientes.reduce((acc, r) => acc + (r.valores_fixos.adiantamento_config || 0), 0);
        const saldoFinal = totalTurnos + proRataMeiFinal + saldoAvulso;

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
            return {
                ...(fechamentoExistente.resumo_json as ExtratoMensal),
                status: FINANCEIRO_STATUS.PAGO,
                id_fechamento: fechamentoExistente.id,
                data_pagamento: toBRTime(fechamentoExistente.data_pagamento)
            };
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

        return this._calcularMatematicaExtrato({
            usuarioId,
            mes,
            ano,
            usuario,
            links: links || [],
            ocorrencias: ocorrencias || [],
            fechamentoAnterior,
            pontos: pontos || [],
            feriadosMes,
            confirmacaoAdiantamento
        });
    },

    /**
     * Calcula dados agregados do dashboard financeiro para todos os colaboradores no mes/ano em lote.
     */
    async getDashboardLote(mes: number, ano: number) {
        const { data: colaboradoresAtivos } = await supabaseAdmin
            .from("usuarios")
            .select("id, valor_mei")
            .eq("status", "ATIVO");

        if (!colaboradoresAtivos || colaboradoresAtivos.length === 0) {
            return { totalFolha: 0, valorPago: 0, restaPagar: 0, pendentesCount: 0 };
        }

        const { data: fechamentos } = await supabaseAdmin
            .from("fechamentos_financeiros")
            .select("colaborador_id, saldo_final")
            .eq("mes", mes)
            .eq("ano", ano)
            .eq("pago", true);

        const fechamentosMap = new Map();
        let valorPago = 0;

        (fechamentos || []).forEach(f => {
            fechamentosMap.set(f.colaborador_id, f);
            valorPago += f.saldo_final || 0;
        });

        const pendentes = colaboradoresAtivos.filter(c => !fechamentosMap.has(c.id));

        if (pendentes.length === 0) {
            return { totalFolha: valorPago, valorPago, restaPagar: 0, pendentesCount: 0 };
        }

        const pendentesIds = pendentes.map(p => p.id);
        const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dataInicioMesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFimMesStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

        // Busca em Lote: Vínculos
        const { data: todosLinks } = await supabaseAdmin
            .from("colaborador_clientes")
            .select("*, cliente:clientes(*), unidade:unidades_cliente(*), horarios:colaborador_cliente_horarios(*)")
            .in("colaborador_id", pendentesIds);

        const linksPorUsuario = new Map();
        (todosLinks || []).forEach(l => {
            if (!linksPorUsuario.has(l.colaborador_id)) linksPorUsuario.set(l.colaborador_id, []);
            linksPorUsuario.get(l.colaborador_id).push(l);
        });

        // Busca em Lote: Ocorrencias
        const { data: todasOcorrenciasRaw } = await supabaseAdmin
            .from("ocorrencias")
            .select("*, tipo:tipos_ocorrencia(id, descricao)")
            .in("colaborador_id", pendentesIds)
            .gte("data_ocorrencia", dataInicioMesStr)
            .lte("data_ocorrencia", dataFimMesStr);
        
        const ocorrenciasPorUsuario = new Map();
        (todasOcorrenciasRaw || []).forEach(o => {
            if (!ocorrenciasPorUsuario.has(o.colaborador_id)) ocorrenciasPorUsuario.set(o.colaborador_id, []);
            ocorrenciasPorUsuario.get(o.colaborador_id).push(o);
        });

        // Busca em Lote: Saldo Mês Anterior
        let mesAnterior = mes - 1;
        let anoAnterior = ano;
        if (mesAnterior === 0) { mesAnterior = 12; anoAnterior = ano - 1; }
        
        const { data: fechamentosAnteriores } = await supabaseAdmin
            .from("fechamentos_financeiros")
            .select("colaborador_id, saldo_final")
            .in("colaborador_id", pendentesIds)
            .eq("mes", mesAnterior)
            .eq("ano", anoAnterior)
            .eq("pago", true);

        const fechamentosAnterioresMap = new Map();
        (fechamentosAnteriores || []).forEach(f => {
            fechamentosAnterioresMap.set(f.colaborador_id, f);
        });

        // Busca em Lote: Pontos
        const { data: todosPontos } = await supabaseAdmin
            .from("registros_ponto")
            .select("*")
            .in("usuario_id", pendentesIds)
            .gte("data_referencia", dataInicioMesStr)
            .lte("data_referencia", dataFimMesStr);

        const pontosPorUsuario = new Map();
        (todosPontos || []).forEach(p => {
            if (!pontosPorUsuario.has(p.usuario_id)) pontosPorUsuario.set(p.usuario_id, []);
            pontosPorUsuario.get(p.usuario_id).push(p);
        });

        // Feriados Globais
        const { data: feriadosData } = await supabaseAdmin
            .from("feriados")
            .select("data")
            .gte("data", dataInicioMesStr)
            .lte("data", dataFimMesStr);
        const feriadosMes = new Set((feriadosData || []).map(f => f.data));

        // Busca em Lote: Confirmações Adiantamento
        const { data: confirmacoes } = await supabaseAdmin
            .from("confirmacoes_adiantamento")
            .select("colaborador_id")
            .in("colaborador_id", pendentesIds)
            .eq("mes", mes)
            .eq("ano", ano);
        
        const confirmacoesSet = new Set((confirmacoes || []).map(c => c.colaborador_id));

        // Calcular vivos
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
                confirmacaoAdiantamento: confirmacoesSet.has(usuario.id) ? true : null
            });

            restaPagar += extrato.totais.saldo_final || 0;
        });

        const totalFolha = valorPago + restaPagar;

        return {
            totalFolha: parseFloat(totalFolha.toFixed(2)),
            valorPago: parseFloat(valorPago.toFixed(2)),
            restaPagar: parseFloat(restaPagar.toFixed(2)),
            pendentesCount: pendentes.length
        };
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
        return formatFechamento(data);
    },

    /**
     * Confirma o pagamento do adiantamento para um colaborador no mês/ano.
     */
    async confirmarAdiantamento(usuarioId: string, mes: number, ano: number, confirmadoPor: string): Promise<boolean> {
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
            confirmado_por: confirmadoPor,
            data_confirmacao: getNowBR()
        };

        if (existing) {
            payload.id = existing.id;
        }

        const { data, error } = await supabaseAdmin
            .from("confirmacoes_adiantamento")
            .upsert(payload)
            .select()
            .single();

        if (error) throw error;
        return true;
    },

    /**
     * Remove a confirmação do pagamento de adiantamento.
     */
    async desconfirmarAdiantamento(usuarioId: string, mes: number, ano: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("confirmacoes_adiantamento")
            .delete()
            .eq("colaborador_id", usuarioId)
            .eq("mes", mes)
            .eq("ano", ano);

        if (error) throw error;
    },

    /**
     * Remove o snapshot de pagamento, voltando o extrato ao estado de rascunho.
     */
    async desfazerPagamento(usuarioId: string, mes: number, ano: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("fechamentos_financeiros")
            .delete()
            .eq("colaborador_id", usuarioId)
            .eq("mes", mes)
            .eq("ano", ano);

        if (error) throw error;
    },

    async getStatusGeral(mes: number, ano: number): Promise<StatusGeralFechamento[]> {
        const { data: colaboradores, error: colabError } = await supabaseAdmin
            .from("usuarios")
            .select("id, nome_completo, email, status")
            .eq("status", "ATIVO")
            .order("nome_completo", { ascending: true });

        if (colabError) throw colabError;

        const { data: confirmacoes } = await supabaseAdmin
            .from("confirmacoes_adiantamento")
            .select("*")
            .eq("mes", mes)
            .eq("ano", ano);

        const { data: fechamentos } = await supabaseAdmin
            .from("fechamentos_financeiros")
            .select("*")
            .eq("mes", mes)
            .eq("ano", ano);

        const { data: todosTurnos } = await supabaseAdmin
            .from("colaborador_clientes")
            .select("colaborador_id, valor_adiantamento, cliente:clientes(nome_fantasia)");

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

            const valorAdiantamentoConfigurado = turnos.reduce((acc, t) => acc + (t.valor_adiantamento || 0), 0);

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
                valor_final: parseFloat(valorFinal.toFixed(2)),
                clientes: clientesUnicos
            };
        });
    }
};
