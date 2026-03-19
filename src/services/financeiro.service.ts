import { supabaseAdmin } from "../config/supabase.js";
import { FINANCEIRO_STATUS, LANCAMENTO_TIPO } from "../constants/financeiro.enum.js";
import { getNowBR, toBRTime } from "../utils/utils.js";
import { ocorrenciaService } from "./ocorrencia.service.js";

import { ExtratoMensal, FechamentoPayload, ConfirmacaoAdiantamentoPayload } from "../types/financeiro.type.js";

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
     * Gera o extrato financeiro mensal de um colaborador.
     * Consolida ganhos (contrato), descontos (adiantamento, ocorrências) e ajustes (pro-rata).
     */
    async getExtratoMensal(usuarioId: string, mes: number, ano: number): Promise<ExtratoMensal> {
        // 1. Verificar se já existe um fechamento (Snapshot) para este mês
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

        // 2. Cálculo Dinâmico (Rascunho)
        const { data: usuario, error: userError } = await supabaseAdmin
            .from("usuarios")
            .select("valor_mei")
            .eq("id", usuarioId)
            .single();

        if (userError) throw userError;

        const { data: links, error: linkError } = await supabaseAdmin
            .from("colaborador_clientes")
            .select("*, cliente:clientes(*), unidade:unidades_cliente(*)")
            .eq("colaborador_id", usuarioId);

        if (linkError) throw linkError;

        const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dataInicioStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFimStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

        const ocorrencias = await ocorrenciaService.listOcorrencias({ usuario_id: usuarioId, data_inicio: dataInicioStr, data_fim: dataFimStr });
        
        const { data: confirmacaoAdiantamento } = await supabaseAdmin
            .from("confirmacoes_adiantamento")
            .select("*")
            .eq("colaborador_id", usuarioId)
            .eq("mes", mes)
            .eq("ano", ano)
            .maybeSingle();

        const adiantamentoConfirmado = !!confirmacaoAdiantamento;

        const resumoClientes = (links || []).map(link => {
            const escalaSemanal = link.unidade?.escala_semanal || [1, 2, 3, 4, 5, 6]; 

            const valorAdiantamentoConfig = link.valor_adiantamento || 0;
            const valorAdiantamentoEfetivo = adiantamentoConfirmado ? valorAdiantamentoConfig : 0;

            const dataInicioTurno = link.data_inicio ? new Date(link.data_inicio) : null;
            let diaInicioEfetivo = 1;
            const diaFimEfetivo = ultimoDiaMes;

            if (dataInicioTurno) {
                const mesInicio = dataInicioTurno.getUTCMonth() + 1;
                const anoInicio = dataInicioTurno.getUTCFullYear();
                if (anoInicio === ano && mesInicio === mes) {
                    diaInicioEfetivo = dataInicioTurno.getUTCDate();
                } else if (anoInicio > ano || (anoInicio === ano && mesInicio > mes)) {
                    return null;
                }
            }

            let diasUteisNoMesTotal = 0;
            for (let d = 1; d <= ultimoDiaMes; d++) {
                const dataAtual = new Date(Date.UTC(ano, mes - 1, d));
                const diaSemana = dataAtual.getUTCDay();
                if (escalaSemanal.includes(diaSemana)) {
                    diasUteisNoMesTotal++;
                }
            }

            let diasAtivosNoMes = 0;
            const datasAtivas: string[] = [];
            for (let d = diaInicioEfetivo; d <= diaFimEfetivo; d++) {
                const dataAtual = new Date(Date.UTC(ano, mes - 1, d));
                const diaSemana = dataAtual.getUTCDay();
                if (escalaSemanal.includes(diaSemana)) {
                    diasAtivosNoMes++;
                    datasAtivas.push(dataAtual.toISOString().split('T')[0]);
                }
            }

            const valorBonusEfetivo = (diasAtivosNoMes > 0 && diasAtivosNoMes === diasUteisNoMesTotal) 
                ? (link.valor_bonus || 0) 
                : 0;

            const entradasFixas = (link.valor_contrato || 0) + valorBonusEfetivo + (link.ajuda_custo || 0) + (link.valor_aluguel || 0);
            const saidasFixas = valorAdiantamentoEfetivo;
            const saldoFixoTurno = entradasFixas - saidasFixas;

            const ocorrenciasDesteTurno = ocorrencias.filter(o => o.colaborador_cliente_id === link.id && o.impacto_financeiro);
            const totalCreditosTurno = ocorrenciasDesteTurno.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.ENTRADA).reduce((acc, o) => acc + (o.valor || 0), 0);
            const totalDebitosTurno = ocorrenciasDesteTurno.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.SAIDA).reduce((acc, o) => acc + (o.valor || 0), 0);

            const proRataBase = diasUteisNoMesTotal > 0 ? (saldoFixoTurno / diasUteisNoMesTotal) * diasAtivosNoMes : 0;
            const valorFinalTurno = proRataBase + totalCreditosTurno - totalDebitosTurno;

            return {
                cliente_id: link.cliente_id,
                unidade_id: link.unidade_id,
                nome_fantasia: link.cliente?.nome_fantasia,
                nome_unidade: link.unidade?.nome_unidade,
                id_vinculo: link.id,
                saldo_fixo_original: saldoFixoTurno,
                valores_fixos: {
                    contrato: link.valor_contrato || 0,
                    bonus: valorBonusEfetivo,
                    bonus_config: link.valor_bonus || 0,
                    ajuda_custo: link.ajuda_custo || 0,
                    aluguel: link.valor_aluguel || 0,
                    adiantamento: valorAdiantamentoEfetivo,
                    adiantamento_config: valorAdiantamentoConfig
                },
                dias_base_mes: diasUteisNoMesTotal,
                dias_ativos_no_mes: diasAtivosNoMes,
                datas_ativas: datasAtivas,
                data_inicio: link.data_inicio || null,
                data_fim: link.data_fim || null,
                creditos_ocorrencia: totalCreditosTurno,
                debitos_ocorrencia: totalDebitosTurno,
                valor_calculado: parseFloat(valorFinalTurno.toFixed(2))
            };
        }).filter((r): r is Exclude<typeof r, null> => r !== null);

        const valorMeiTotal = usuario?.valor_mei || 0;
        let proRataMeiFinal = 0;
        let diasAtivosUnicos: string[] = [];
        let diasBaseReferencia = 0;

        if (valorMeiTotal > 0 && resumoClientes.length > 0) {
            const todasDatasAtivas = resumoClientes.flatMap(r => r.datas_ativas);
            diasAtivosUnicos = [...new Set(todasDatasAtivas)].sort();

            const turnoPrincipal = resumoClientes.reduce((prev, current) => {
                return (current.dias_ativos_no_mes > prev.dias_ativos_no_mes) ? current : prev;
            }, resumoClientes[0]);

            diasBaseReferencia = turnoPrincipal.dias_base_mes;
            const diasAtivosTotais = diasAtivosUnicos.length;

            if (diasBaseReferencia > 0) {
                proRataMeiFinal = (valorMeiTotal / diasBaseReferencia) * diasAtivosTotais;
                if (proRataMeiFinal > valorMeiTotal) {
                    proRataMeiFinal = valorMeiTotal;
                }
            }
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
                dias_ativos: diasAtivosUnicos.length,
                datas_ativas: diasAtivosUnicos
            },
            ocorrencias: ocorrencias,
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
    }
};
