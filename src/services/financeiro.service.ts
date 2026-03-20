import { supabaseAdmin } from "../config/supabase.js";
import { FINANCEIRO_STATUS, LANCAMENTO_TIPO, CALENDARIO_STATUS } from "../constants/financeiro.enum.js";
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
            .select("*, cliente:clientes(*), unidade:unidades_cliente(*), horarios:colaborador_cliente_horarios(*)")
            .eq("colaborador_id", usuarioId);

        if (linkError) throw linkError;

        const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dataInicioMesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFimMesStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

        // Buscar ocorrências e pontos do período
        const ocorrencias = await ocorrenciaService.listOcorrencias({ usuario_id: usuarioId, data_inicio: dataInicioMesStr, data_fim: dataFimMesStr });
        const { data: pontos } = await supabaseAdmin
            .from("pontos")
            .select("*")
            .eq("usuario_id", usuarioId)
            .gte("data_referencia", dataInicioMesStr)
            .lte("data_referencia", dataFimMesStr);
        
        const { data: confirmacaoAdiantamento } = await supabaseAdmin
            .from("confirmacoes_adiantamento")
            .select("*")
            .eq("colaborador_id", usuarioId)
            .eq("mes", mes)
            .eq("ano", ano)
            .maybeSingle();

        const adiantamentoConfirmado = !!confirmacaoAdiantamento;

        const resumoClientes = (links || []).map(link => {
            const dataInicioTurno = link.data_inicio ? new Date(link.data_inicio + 'T00:00:00') : null;
            const dataFimTurno = link.data_fim ? new Date(link.data_fim + 'T23:59:59') : null;

            let diasEscalaNoMesTotal = 0;   // Base (Divisor)
            let diasEsperadosTurno = 0;     // Meta individual
            const calendarioVisual: any[] = [];

            // 1. Loop diário para análise de escala, vigência e status visual
            const now = new Date();
            const hojeLocalStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
            const hojeFimDia = new Date(hojeLocalStr + 'T23:59:59');

            for (let d = 1; d <= ultimoDiaMes; d++) {
                const dataAtual = new Date(Date.UTC(ano, mes - 1, d));
                const dataReferenciaStr = dataAtual.toISOString().split('T')[0];
                const diaSemana = dataAtual.getUTCDay();
                
                // O sistema agora é 100% dependente da escala flexível configurada.
                // Dias não configurados na tabela de horários individuais não são considerados dias de escala.
                const isDiaEscala = (link as any).horarios && (link as any).horarios.some((h: any) => h.dia_semana === diaSemana);

                // Data para comparação de vigência
                const dtComparacao = new Date(dataReferenciaStr + 'T12:00:00');
                const isVigente = (!dataInicioTurno || dtComparacao >= dataInicioTurno) && (!dataFimTurno || dtComparacao <= dataFimTurno);
                const isFuturo = dtComparacao > hojeFimDia;

                if (isDiaEscala) {
                    diasEscalaNoMesTotal++;
                    if (isVigente) diasEsperadosTurno++;
                }

                // Status Visual
                let status: string = CALENDARIO_STATUS.NAO_VIGENTE;
                if (isVigente) {
                    if (isFuturo) {
                        status = CALENDARIO_STATUS.FUTURO;
                    } else if (isDiaEscala) {
                        const temPonto = (pontos || []).some(p => p.data_referencia === dataReferenciaStr && p.colaborador_cliente_id === link.id);
                        status = temPonto ? CALENDARIO_STATUS.TRABALHADO : CALENDARIO_STATUS.FALTA;
                    } else {
                        status = CALENDARIO_STATUS.NAO_VIGENTE;
                    }
                }

                // Só incluir se for dia de escala para visualização limpa
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

            // 2. Contar Pontos Efetivos (Trabalhados)
            const pontosDesteTurno = (pontos || []).filter(p => {
                const dataPonto = new Date(p.data_referencia + 'T12:00:00');
                if (p.colaborador_cliente_id !== link.id) return false;
                if (dataInicioTurno && dataPonto < dataInicioTurno) return false;
                if (dataFimTurno && dataPonto > dataFimTurno) return false;
                return true;
            });

            const diasTrabalhados = pontosDesteTurno.length;

            // 3. Regra de Bônus: Apenas se trabalhou 100% da escala MENSAL da unidade
            const bonusEfetivo = diasTrabalhados >= diasEscalaNoMesTotal ? (link.valor_bonus || 0) : 0;

            const valorAdiantamentoConfig = link.valor_adiantamento || 0;
            const valorAdiantamentoEfetivo = adiantamentoConfirmado ? valorAdiantamentoConfig : 0;

            // 4. Cálculo do Pro-rata (Contrato + Ajuda + Aluguel - Adiantamento) + Bônus (Não pro-rata)
            const baseFixaParaProRata = (link.valor_contrato || 0) + (link.ajuda_custo || 0) + (link.valor_aluguel || 0) - valorAdiantamentoEfetivo;
            const valorCalculadoProRata = (baseFixaParaProRata / diasEscalaNoMesTotal) * diasTrabalhados;
            const valorFinalComBonus = valorCalculadoProRata + bonusEfetivo;

            // Ocorrências vinculadas a este turno
            const ocorrenciasDesteTurno = ocorrencias.filter(o => o.colaborador_cliente_id === link.id && o.impacto_financeiro);
            const totalCreditosTurno = ocorrenciasDesteTurno.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.ENTRADA).reduce((acc, o) => acc + (o.valor || 0), 0);
            const totalDebitosTurno = ocorrenciasDesteTurno.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.SAIDA).reduce((acc, o) => acc + (o.valor || 0), 0);

            return {
                cliente_id: link.cliente_id,
                unidade_id: link.unidade_id,
                nome_fantasia: link.cliente?.nome_fantasia,
                nome_unidade: link.unidade?.nome_unidade,
                id_vinculo: link.id,
                saldo_fixo_original: baseFixaParaProRata + (link.valor_bonus || 0),
                valores_fixos: {
                    contrato: link.valor_contrato || 0,
                    bonus: bonusEfetivo,
                    bonus_config: link.valor_bonus || 0,
                    ajuda_custo: link.ajuda_custo || 0,
                    aluguel: link.valor_aluguel || 0,
                    adiantamento: valorAdiantamentoEfetivo,
                    adiantamento_config: valorAdiantamentoConfig
                },
                dias_base_mes: diasEscalaNoMesTotal,
                dias_esperados_turno: diasEsperadosTurno,
                dias_trabalhados: diasTrabalhados,
                calendario_visual: calendarioVisual,
                data_inicio: link.data_inicio || null,
                data_fim: link.data_fim || null,
                creditos_ocorrencia: totalCreditosTurno,
                debitos_ocorrencia: totalDebitosTurno,
                valor_calculado: parseFloat((valorFinalComBonus + totalCreditosTurno - totalDebitosTurno).toFixed(2))
            };
        }).filter((r): r is Exclude<typeof r, null> => r !== null);

        // 5. Consolidação MEI
        const valorMeiTotal = usuario?.valor_mei || 0;
        let proRataMeiFinal = 0;
        let diasAtivosUnicos: string[] = [];
        let diasBaseReferencia = 26; // Padrão Seg-Sab caso não tenha turnos

        if (valorMeiTotal > 0) {
            // Dias únicos com presença em QUALQUER turno
            const datasComPonto = [...new Set((pontos || []).map(p => p.data_referencia))].sort();
            diasAtivosUnicos = datasComPonto;

            // Usamos a escala do primeiro turno como referência de base, ou 26 se vazio
            if (resumoClientes.length > 0) {
                diasBaseReferencia = resumoClientes[0].dias_base_mes;
            }

            proRataMeiFinal = (valorMeiTotal / diasBaseReferencia) * diasAtivosUnicos.length;
            if (proRataMeiFinal > valorMeiTotal) proRataMeiFinal = valorMeiTotal;
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
