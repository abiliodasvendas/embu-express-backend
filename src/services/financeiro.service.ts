import { supabaseAdmin } from "../config/supabase.js";
import { FINANCEIRO_STATUS, LANCAMENTO_TIPO } from "../constants/financeiro.enum.js";
import { ocorrenciaService } from "./ocorrencia.service.js";

export const financeiroService = {
    /**
     * Gera o extrato financeiro mensal de um colaborador.
     * Consolida ganhos (contrato), descontos (adiantamento, ocorrências) e ajustes (pro-rata).
     */
    async getExtratoMensal(usuarioId: string, mes: number, ano: number): Promise<any> {
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
                ...fechamentoExistente.resumo_json,
                status: FINANCEIRO_STATUS.PAGO,
                id_fechamento: fechamentoExistente.id,
                data_pagamento: fechamentoExistente.data_pagamento
            };
        }

        // 2. Cálculo Dinâmico (Rascunho)
        // Buscar Vínculos (Turnos) do Colaborador
        const { data: links, error: linkError } = await supabaseAdmin
            .from("colaborador_clientes")
            .select("*, cliente:clientes(*)")
            .eq("colaborador_id", usuarioId);

        if (linkError) throw linkError;

        // Buscar Ocorrências do período
        const dataInicioMes = new Date(Date.UTC(ano, mes - 1, 1));
        const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dataInicioStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFimStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

        const ocorrencias = await ocorrenciaService.listOcorrencias({ usuario_id: usuarioId, data_inicio: dataInicioStr, data_fim: dataFimStr });

        // 3. Processar cada vínculo para calcular o Saldo Fixo Pro-Rata
        const resumoClientes = links.map(link => {
            const escalaSemanal = link.cliente?.escala_semanal || [1, 2, 3, 4, 5, 6]; // Padrão: Seg-Sáb

            const entradasFixas = (link.valor_contrato || 0) + (link.valor_mei || 0) + (link.valor_bonus || 0) + (link.ajuda_custo || 0) + (link.valor_aluguel || 0);
            const saidasFixas = (link.valor_adiantamento || 0);
            const saldoFixoTurno = entradasFixas - saidasFixas;

            // --- CALCULO PRO-RATA BASEADO EM ESCALA (AGENDA) ---
            const dataInicioTurno = link.data_inicio ? new Date(link.data_inicio) : null;
            let diaInicioEfetivo = 1;
            let diaFimEfetivo = ultimoDiaMes;

            // Ajuste Início
            if (dataInicioTurno) {
                const mesInicio = dataInicioTurno.getUTCMonth() + 1;
                const anoInicio = dataInicioTurno.getUTCFullYear();
                if (anoInicio === ano && mesInicio === mes) {
                    diaInicioEfetivo = dataInicioTurno.getUTCDate();
                } else if (anoInicio > ano || (anoInicio === ano && mesInicio > mes)) {
                    return null;
                }
            }

            // 1. CALCULAR DIAS TOTAIS POSSÍVEIS NO MÊS (BASE DINÂMICA)
            let diasUteisNoMesTotal = 0;
            for (let d = 1; d <= ultimoDiaMes; d++) {
                const dataAtual = new Date(Date.UTC(ano, mes - 1, d));
                const diaSemana = dataAtual.getUTCDay();
                if (escalaSemanal.includes(diaSemana)) {
                    diasUteisNoMesTotal++;
                }
            }

            // 2. CALCULAR DIAS REALMENTE ATIVOS NO PERÍODO (PRO-RATA)
            let diasAtivosNoMes = 0;
            const datasAtivas: string[] = [];
            for (let d = diaInicioEfetivo; d <= diaFimEfetivo; d++) {
                const dataAtual = new Date(Date.UTC(ano, mes - 1, d));
                const diaSemana = dataAtual.getUTCDay();
                if (escalaSemanal.includes(diaSemana)) {
                    diasAtivosNoMes++;
                    datasAtivas.push(dataAtual.toISOString().split('T')[0]); // Guarda a data no formato YYYY-MM-DD
                }
            }

            // Ocorrências vinculadas a este turno
            const ocorrenciasDesteTurno = ocorrencias.filter(o => o.colaborador_cliente_id === link.id && o.impacto_financeiro);
            const totalCreditosTurno = ocorrenciasDesteTurno.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.ENTRADA).reduce((acc, o) => acc + (o.valor || 0), 0);
            const totalDebitosTurno = ocorrenciasDesteTurno.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.SAIDA).reduce((acc, o) => acc + (o.valor || 0), 0);

            // Fórmula Dinâmica: (Salário / DiasÚteisDoMês) * DiasAtivosNoPeríodo
            const proRataBase = diasUteisNoMesTotal > 0 ? (saldoFixoTurno / diasUteisNoMesTotal) * diasAtivosNoMes : 0;
            const valorFinalTurno = proRataBase + totalCreditosTurno - totalDebitosTurno;

            return {
                cliente_id: link.cliente_id,
                nome_fantasia: link.cliente?.nome_fantasia,
                id_vinculo: link.id,
                saldo_fixo_original: saldoFixoTurno,
                valores_fixos: {
                    contrato: link.valor_contrato || 0,
                    mei: link.valor_mei || 0,
                    bonus: link.valor_bonus || 0,
                    ajuda_custo: link.ajuda_custo || 0,
                    aluguel: link.valor_aluguel || 0,
                    adiantamento: link.valor_adiantamento || 0
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
        }).filter(Boolean); // Remove vínculos inativos no período

        // 4. Ocorrências Avulsas (não vinculadas a turno)
        const ocorrenciasAvulsas = ocorrencias.filter(o => !o.colaborador_cliente_id && o.impacto_financeiro);
        const creditosAvulsos = ocorrenciasAvulsas.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.ENTRADA).reduce((acc, o) => acc + (o.valor || 0), 0);
        const debitosAvulsos = ocorrenciasAvulsas.filter(o => o.tipo_lancamento === LANCAMENTO_TIPO.SAIDA).reduce((acc, o) => acc + (o.valor || 0), 0);
        const saldoAvulso = creditosAvulsos - debitosAvulsos;

        // 5. Consolidado Final
        const totalTurnos = (resumoClientes as any[]).reduce((acc, r) => acc + (r?.valor_calculado || 0), 0);
        const saldoFinal = totalTurnos + saldoAvulso;

        return {
            periodo: { mes, ano },
            status: FINANCEIRO_STATUS.RASCUNHO,
            resumo_por_cliente: resumoClientes,
            ocorrencias: ocorrencias,
            ocorrencias_avulsas: {
                creditos: creditosAvulsos,
                debitos: debitosAvulsos,
                saldo: parseFloat(saldoAvulso.toFixed(2))
            },
            totais: {
                total_turnos: parseFloat(totalTurnos.toFixed(2)),
                total_avulso: parseFloat(saldoAvulso.toFixed(2)),
                saldo_final: parseFloat(saldoFinal.toFixed(2))
            }
        };
    },

    /**
     * Efetua o fechamento e pagamento em uma única ação.
     * Gera o snapshot e marca como pago.
     */
    async processarPagamento(usuarioId: string, mes: number, ano: number, pagoPor: string): Promise<any> {
        // Gera o cálculo atual (Rascunho)
        const extrato = await this.getExtratoMensal(usuarioId, mes, ano);

        // Salva o snapshot final e marca como pago simultaneamente
        const { data, error } = await supabaseAdmin
            .from("fechamentos_financeiros")
            .upsert({
                colaborador_id: usuarioId,
                mes,
                ano,
                resumo_json: extrato,
                saldo_final: extrato.totais.saldo_final,
                fechado_por: pagoPor,
                data_fechamento: new Date().toISOString(),
                pago: true,
                data_pagamento: new Date().toISOString()
            }, { onConflict: "colaborador_id, mes, ano" })
            .select()
            .single();

        if (error) throw error;
        return data;
    }
};
