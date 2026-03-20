import { supabaseAdmin } from "../config/supabase.js";
import { CALENDARIO_STATUS } from "../constants/financeiro.enum.js";
import { parseTime } from "./ponto-calculator.service.js";
import { toBRTime } from "../utils/utils.js";

export interface PontoDiarioRelatorio {
    data: string;
    data_br: string;
    dia: number;
    dia_semana_curto: string;
    dia_semana_longo: string;
    status: string;
    is_dia_escala: boolean;
    cliente_nome: string | null; // Novo: Nome do cliente (para visão consolidada)
    minutos_esperados: number;
    minutos_trabalhados: number;
    minutos_saldo: number;
    entrada_hora: string | null;
    saida_hora: string | null;
    shift_entrada: string | null; // Novo: Horário esperado de entrada (HH:mm)
    shift_saida: string | null;   // Novo: Horário esperado de saída (HH:mm)
    entrada_km: number | null;
    saida_km: number | null;
    km_rodado: number; // Novo: KM rodado em trabalho
    unidade_nome: string | null; // Novo: Nome da unidade
}

export interface EspelhoPontoMensal {
    shift_id: number;
    cliente_nome: string;
    unidade_nome: string;
    periodo: { mes: number; ano: number };
    kpis: {
        dias_base_mes: number;
        dias_meta_turno: number;
        dias_trabalhados: number;
        dias_faltas: number;
        horas_esperadas: number; // minutos
        horas_trabalhadas: number; // minutos
        horas_faltas: number; // minutos
        horas_extras: number; // minutos (saldo positivo)
        horas_devidas: number; // minutos (saldo negativo)
        km_contratado: number;
        km_realizado: number;
        km_saldo: number;
    };
    calendario: PontoDiarioRelatorio[];
}

export const pontoRelatorioService = {
    async getEspelhoPonto(usuarioId: string, mes: number, ano: number): Promise<EspelhoPontoMensal[]> {
        const lastDayOfMonth = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const startOfMonth = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const endOfMonth = `${ano}-${String(mes).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

        // 1. Buscar vínculos e configurações
        const { data: links } = await supabaseAdmin
            .from("colaborador_clientes")
            .select("*, cliente:clientes(nome_fantasia), unidade:unidades_cliente(*), horarios:colaborador_cliente_horarios(*)")
            .eq("colaborador_id", usuarioId);

        // 2. Buscar todos os pontos do mês
        const { data: allPoints } = await supabaseAdmin
            .from("registros_ponto")
            .select("*")
            .eq("usuario_id", usuarioId)
            .gte("data_referencia", startOfMonth)
            .lte("data_referencia", endOfMonth)
            .order("data_referencia", { ascending: true })
            .order("entrada_hora", { ascending: true });

        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA');
        const endOfToday = new Date(todayStr + 'T23:59:59');

        const shiftReports: EspelhoPontoMensal[] = [];

        // Estrutura para consolidar dados de todos os turnos
        const globalKpis = {
            dias_base_mes: 0,
            dias_meta_turno: 0,
            dias_trabalhados: 0,
            dias_faltas: 0,
            horas_esperadas: 0,
            horas_trabalhadas: 0,
            horas_faltas: 0,
            horas_extras: 0,
            horas_devidas: 0,
            km_contratado: 0,
            km_realizado: 0,
            km_saldo: 0
        };

        // Cache para o calendário consolidado (chave: dia)
        const globalCalendarMap = new Map<number, PontoDiarioRelatorio>();

        for (const link of (links || [])) {
            const unitSchedule = link.unidade?.escala_semanal || [1, 2, 3, 4, 5, 6];
            const startShift = link.data_inicio ? new Date(link.data_inicio + 'T00:00:00') : null;
            const endShiftValue = link.data_fim ? new Date(link.data_fim + 'T23:59:59') : null;

            const shiftKpis = {
                dias_base_mes: 0,
                dias_meta_turno: 0,
                dias_trabalhados: 0,
                dias_faltas: 0,
                horas_esperadas: 0,
                horas_trabalhadas: 0,
                horas_faltas: 0,
                horas_extras: 0,
                horas_devidas: 0,
                km_contratado: link.unidade?.km_contratados || 0,
                km_realizado: 0,
                km_saldo: 0
            };

            const calendar: PontoDiarioRelatorio[] = [];
            const shiftPoints = (allPoints || []).filter(p => p.colaborador_cliente_id === link.id);

            let firstKm: number | null = null;
            let lastKm: number | null = null;

            for (let d = 1; d <= lastDayOfMonth; d++) {
                const currentDate = new Date(Date.UTC(ano, mes - 1, d));
                const refDateStr = currentDate.toISOString().split('T')[0];
                const weekDayNum = currentDate.getUTCDay();

                // RESOLUÇÃO DE ESCALA: Exclusivamente via Escala Flexível (Novo Modelo)
                const shiftDayConfig = link.horarios?.find((h: any) => h.dia_semana === weekDayNum);
                const hasShiftConfig = !!shiftDayConfig;

                const dtCheck = new Date(refDateStr + 'T12:00:00');
                const isActive = (!startShift || dtCheck >= startShift) && (!endShiftValue || dtCheck <= endShiftValue);
                const isFutureDate = dtCheck > endOfToday;

                let dayExpectedMin = 0;
                if (hasShiftConfig && isActive) {
                    const [hI, mI] = parseTime(shiftDayConfig.hora_inicio);
                    const [hF, mF] = parseTime(shiftDayConfig.hora_fim);
                    const tolPausa = shiftDayConfig.tolerancia_pausa_min || 0;
                    
                    let totalMin = (hF * 60 + mF) - (hI * 60 + mI);
                    if (totalMin < 0) totalMin += 1440;
                    dayExpectedMin = Math.max(0, totalMin - tolPausa);

                    if (isActive) {
                        shiftKpis.dias_meta_turno++;
                        shiftKpis.horas_esperadas += dayExpectedMin;
                    }
                }

                const dailyPoint = shiftPoints.find(p => p.data_referencia === refDateStr);
                let dayWorkedMin = 0;
                let dayWorkedKm = 0;
                let dayStatus: string = CALENDARIO_STATUS.NAO_VIGENTE;

                if (dailyPoint) {
                    shiftKpis.dias_trabalhados++;
                    if (dailyPoint.saldo_minutos != null) {
                        const saldo = dailyPoint.saldo_minutos;
                        dayWorkedMin = dayExpectedMin + saldo;
                        if (saldo > 0) shiftKpis.horas_extras += saldo;
                        else if (saldo < 0) shiftKpis.horas_devidas += Math.abs(saldo);
                    } else if (dailyPoint.detalhes_calculo?.resumo?.horas_trabalhadas) {
                         const parts = dailyPoint.detalhes_calculo.resumo.horas_trabalhadas.split(' ');
                         const h = parseInt(parts[0]) || 0;
                         const m = parseInt(parts[1]) || 0;
                         dayWorkedMin = h * 60 + m;
                    }

                    shiftKpis.horas_trabalhadas += dayWorkedMin;
                    dayWorkedKm = dailyPoint.detalhes_calculo?.resumo?.km_trabalhado || 0;
                    dayStatus = CALENDARIO_STATUS.TRABALHADO;

                    if (dailyPoint.entrada_km != null) {
                        if (firstKm === null) firstKm = dailyPoint.entrada_km;
                        lastKm = dailyPoint.entrada_km;
                    }
                    if (dailyPoint.saida_km != null) {
                        if (firstKm === null) firstKm = dailyPoint.saida_km;
                        lastKm = dailyPoint.saida_km;
                    }
                } else if (isActive) {
                    if (isFutureDate) {
                        dayStatus = CALENDARIO_STATUS.FUTURO;
                    } else if (hasShiftConfig) {
                        dayStatus = CALENDARIO_STATUS.FALTA;
                        shiftKpis.dias_faltas++;
                        shiftKpis.horas_faltas += dayExpectedMin;
                        shiftKpis.horas_devidas += dayExpectedMin;
                    }
                }

                const dayOfWeekNames = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
                const dayOfWeekLong = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

                const dailyEntry: PontoDiarioRelatorio = {
                    data: refDateStr,
                    data_br: refDateStr.split('-').reverse().join('/'),
                    dia: d,
                    dia_semana_curto: dayOfWeekNames[weekDayNum],
                    dia_semana_longo: dayOfWeekLong[weekDayNum],
                    status: dayStatus,
                    is_dia_escala: hasShiftConfig,
                    cliente_nome: link.cliente?.nome_fantasia || null,
                    minutos_esperados: dayExpectedMin,
                    minutos_trabalhados: dayWorkedMin,
                    minutos_saldo: dailyPoint?.saldo_minutos || (dayStatus === CALENDARIO_STATUS.FALTA ? -dayExpectedMin : 0),
                    entrada_hora: dailyPoint?.entrada_hora ? toBRTime(dailyPoint.entrada_hora) : null,
                    saida_hora: dailyPoint?.saida_hora ? toBRTime(dailyPoint.saida_hora) : null,
                    shift_entrada: hasShiftConfig ? shiftDayConfig.hora_inicio.substring(0, 5) : null,
                    shift_saida: hasShiftConfig ? shiftDayConfig.hora_fim.substring(0, 5) : null,
                    entrada_km: dailyPoint?.entrada_km || null,
                    saida_km: dailyPoint?.saida_km || null,
                    km_rodado: dayWorkedKm,
                    unidade_nome: link.unidade?.nome_unidade || null
                };

                calendar.push(dailyEntry);

                // CONSOLIDAÇÃO GLOBAL
                let gEntry = globalCalendarMap.get(d);
                if (!gEntry) {
                    gEntry = { ...dailyEntry, cliente_nome: "Consolidado" };
                    globalCalendarMap.set(d, gEntry);
                } else {
                    gEntry.minutos_esperados += dailyEntry.minutos_esperados;
                    gEntry.minutos_trabalhados += dailyEntry.minutos_trabalhados;
                    gEntry.minutos_saldo += dailyEntry.minutos_saldo;
                    if (dailyEntry.is_dia_escala) gEntry.is_dia_escala = true;
                    
                    const priorities: Record<string, number> = { [CALENDARIO_STATUS.TRABALHADO]: 4, [CALENDARIO_STATUS.FALTA]: 3, [CALENDARIO_STATUS.FUTURO]: 2, [CALENDARIO_STATUS.NAO_VIGENTE]: 1 };
                    if (priorities[dailyEntry.status] > priorities[gEntry.status]) {
                        gEntry.status = dailyEntry.status;
                    }
                    
                    if (dailyEntry.entrada_hora && (!gEntry.entrada_hora || dailyEntry.entrada_hora < gEntry.entrada_hora)) gEntry.entrada_hora = dailyEntry.entrada_hora;
                    if (dailyEntry.saida_hora && (!gEntry.saida_hora || dailyEntry.saida_hora > gEntry.saida_hora)) gEntry.saida_hora = dailyEntry.saida_hora;

                    // Consolidado shift hours (fusão das janelas)
                    if (dailyEntry.shift_entrada && (!gEntry.shift_entrada || dailyEntry.shift_entrada < gEntry.shift_entrada)) gEntry.shift_entrada = dailyEntry.shift_entrada;
                    if (dailyEntry.shift_saida && (!gEntry.shift_saida || dailyEntry.shift_saida > gEntry.shift_saida)) gEntry.shift_saida = dailyEntry.shift_saida;
                    
                    if (dailyEntry.entrada_km && (!gEntry.entrada_km || dailyEntry.entrada_km < gEntry.entrada_km)) gEntry.entrada_km = dailyEntry.entrada_km;
                    if (dailyEntry.saida_km && (!gEntry.saida_km || dailyEntry.saida_km > gEntry.saida_km)) gEntry.saida_km = dailyEntry.saida_km;
                }
            }

            if (firstKm !== null && lastKm !== null) shiftKpis.km_realizado = lastKm - firstKm;
            shiftKpis.km_saldo = shiftKpis.km_realizado - shiftKpis.km_contratado;

            globalKpis.horas_esperadas += shiftKpis.horas_esperadas;
            globalKpis.horas_trabalhadas += shiftKpis.horas_trabalhadas;
            globalKpis.horas_faltas += shiftKpis.horas_faltas;
            globalKpis.horas_extras += shiftKpis.horas_extras;
            globalKpis.horas_devidas += shiftKpis.horas_devidas;
            globalKpis.km_contratado += shiftKpis.km_contratado;
            globalKpis.km_realizado += shiftKpis.km_realizado;
            globalKpis.km_saldo += shiftKpis.km_saldo;

            shiftReports.push({
                shift_id: link.id,
                cliente_nome: link.cliente?.nome_fantasia || "N/A",
                unidade_nome: link.unidade?.nome_unidade || "N/A",
                periodo: { mes, ano },
                kpis: shiftKpis,
                // FILTRO: Apenas dias relevantes (com meta ou trabalho)
                calendario: calendar.filter(d => d.minutos_esperados > 0 || d.minutos_trabalhados > 0)
            });
        }

        const finalResult: EspelhoPontoMensal[] = [];
        if (shiftReports.length > 1) {
            // Unir todos os calendários individuais em uma única lista plana (sem agrupar por dia)
            const consolidatedCalendar: PontoDiarioRelatorio[] = [];
            for (const report of shiftReports) {
                consolidatedCalendar.push(...report.calendario);
            }

            // Ordenar por dia (primeiro por dia, depois por turno_id se necessário)
            consolidatedCalendar.sort((a, b) => b.dia - a.dia);

            // Recalcular KPIs globais baseados no totalizador já acumulado (union days logic)
            // Para dias atuados/metas, contamos dias únicos no calendário consolidado
            const uniqueDaysMeta = new Set(consolidatedCalendar.filter(d => d.minutos_esperados > 0).map(d => d.dia));
            const uniqueDaysWorked = new Set(consolidatedCalendar.filter(d => d.status === CALENDARIO_STATUS.TRABALHADO).map(d => d.dia));
            const uniqueDaysLack = new Set(consolidatedCalendar.filter(d => d.status === CALENDARIO_STATUS.FALTA).map(d => d.dia));

            globalKpis.dias_meta_turno = uniqueDaysMeta.size;
            globalKpis.dias_trabalhados = uniqueDaysWorked.size;
            globalKpis.dias_faltas = uniqueDaysLack.size;
            globalKpis.dias_base_mes = lastDayOfMonth;

            finalResult.push({
                shift_id: 0,
                cliente_nome: "Consolidado",
                unidade_nome: "Todos os Turnos",
                periodo: { mes, ano },
                kpis: globalKpis, 
                calendario: consolidatedCalendar // Já está ord. decrescente
            });
        }
        
        // Retornar os relatórios individuais também
        finalResult.push(...shiftReports);
        return finalResult.length > 0 ? finalResult : [];
    }
};
