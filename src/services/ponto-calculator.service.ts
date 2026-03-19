import { supabaseAdmin } from "../config/supabase.js";
import { PONTO_STATUS } from "../constants/ponto.enum.js";
import { getNowBR, toLocalDateString } from "../utils/utils.js";
import { configuracaoService } from "./configuracao.service.js";
import { DetalhesCalculo, ColaboradorCliente } from "../types/database.js";

// Helper para extrair HH e MM de string (ISO ou HH:mm)
export function parseTime(timeStr: string): [number, number] {
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

export const pontoCalculatorService = {
    async calculateStatus(
        usuarioId: string,
        entrada: string | null | undefined,
        saida: string | null | undefined,
        entrada_km?: number | null,
        saida_km?: number | null,
        pausasMinutos: number = 0,
        pausasKmTrabalhado: number = 0,
        pausasKmPausa: number = 0,
        clienteId?: number,
        snapshotTurno?: Partial<ColaboradorCliente>,
        colaboradorClienteId?: number
    ): Promise<{ status_entrada: string; status_saida: string; detalhes_calculo: DetalhesCalculo; saldo_minutos: number | null; melhorTurno?: Partial<ColaboradorCliente> | null }> {
        // Default values
        let status_entrada = PONTO_STATUS.CINZA;
        let status_saida = PONTO_STATUS.CINZA;
        let saldo_minutos: number | null = null;

        const detalhes: DetalhesCalculo = {
            entrada: { turno_base: null, diff_minutos: 0, tolerancia: 0 },
            saida: { turno_base: null, diff_minutos: 0, tolerancia: 0 },
            resumo: {
                horas_trabalhadas: "--:--",
                horas_pausa: `${Math.floor(pausasMinutos / 60)}h ${pausasMinutos % 60}min`,
                pausa_total: pausasMinutos,
                pausa_configurada: 0,
                pausa_extra: 0,
                km_trabalhado: pausasKmTrabalhado,
                km_pausa: pausasKmPausa
            }
        };

        if (entrada_km != null && saida_km != null) {
            detalhes.resumo.diff_km = saida_km - entrada_km;
        }

        if (!entrada) return { status_entrada, status_saida, detalhes_calculo: detalhes, saldo_minutos };

        // 1. Buscar configurações
        const limiteAmarelo = await configuracaoService.getConfiguracao("tolerancia_amarelo_min").then(d => Number(d?.valor || 15));
        const limiteHEExcessiva = await configuracaoService.getConfiguracao("limite_he_excessiva_min").then(d => Number(d?.valor || 120));

        detalhes.entrada.tolerancia = limiteAmarelo;
        detalhes.saida.tolerancia = 0;
        detalhes.saida.limite_he_excessiva = limiteHEExcessiva;
        let melhorTurno: Partial<ColaboradorCliente> | null = null;
        const dateObj = new Date(entrada);
        let dayOfWeek = dateObj.getDay();
        if (dayOfWeek === 0) dayOfWeek = 7; // Standard: 1=Mon, 7=Sun

        if (snapshotTurno) {
            melhorTurno = snapshotTurno;
        } else {
            // 2. Buscar turnos (Links)
            const { data: todosOsTurnos } = await supabaseAdmin
                .from("colaborador_clientes")
                .select("*, horarios:colaborador_cliente_horarios(*)")
                .eq("colaborador_id", usuarioId);

            const hoje = toLocalDateString();
            const turnosValidos = (todosOsTurnos || [])
                .filter(t => !t.data_fim || t.data_fim >= hoje)
                // Filtra apenas turnos que possuem configuração para o dia da semana atual
                .filter(t => t.horarios && t.horarios.length > 0 && t.horarios.some((h: any) => h.dia_semana === dayOfWeek));

            if (turnosValidos.length > 0) {
                const [hEntrada, mEntrada] = parseTime(entrada);
                const entradaMinutosTotal = hEntrada * 60 + mEntrada;

                if (colaboradorClienteId) {
                    melhorTurno = turnosValidos.find(t => String(t.id) === String(colaboradorClienteId)) || null;
                }

                if (!melhorTurno && clienteId) {
                    melhorTurno = turnosValidos.find(t => t.cliente_id === clienteId) || null;
                }

                if (!melhorTurno) {
                    let menorDiff = Infinity;
                    turnosValidos.forEach(turno => {
                        const hConfig = turno.horarios?.find((h: any) => h.dia_semana === dayOfWeek);
                        const expectedStart = hConfig?.hora_inicio;
                        const [hT, mT] = parseTime(expectedStart);
                        const turnoInicioMinutos = hT * 60 + mT;
                        const diff = Math.abs(entradaMinutosTotal - turnoInicioMinutos);
                        if (diff < menorDiff) {
                            menorDiff = diff;
                            melhorTurno = turno;
                        }
                    });
                }
            }
        }

        const hConfig = melhorTurno?.horarios?.find((h: any) => h.dia_semana === dayOfWeek);
        const horaInicioBase = hConfig?.hora_inicio;
        const horaFimBase = hConfig?.hora_fim;
        const tolPausa = hConfig?.tolerancia_pausa_min ?? 0;

        // 3. Cálculos de Entrada
        if (horaInicioBase && horaFimBase) {
            const [hE, mE] = parseTime(entrada);
            const entradaMinutos = hE * 60 + mE;
            const [hT, mT] = parseTime(horaInicioBase);
            const turnoInicioMinutos = hT * 60 + mT;

            const diffEntradaRaw = entradaMinutos - turnoInicioMinutos;
            const diffEntrada = diffEntradaRaw > 720 ? diffEntradaRaw - 1440 : (diffEntradaRaw < -720 ? diffEntradaRaw + 1440 : diffEntradaRaw);

            detalhes.entrada.turno_base = horaInicioBase;
            detalhes.entrada.diff_minutos = diffEntrada;

            if (diffEntrada < 0) status_entrada = PONTO_STATUS.ANTECIPADA;
            else if (diffEntrada === 0 || entradaMinutos === turnoInicioMinutos) status_entrada = PONTO_STATUS.VERDE;
            else if (diffEntrada <= limiteAmarelo) status_entrada = PONTO_STATUS.AMARELO;
            else status_entrada = PONTO_STATUS.VERMELHO;

            detalhes.saida.turno_base = horaFimBase;

            // 4. Cálculos de Saída
            if (saida) {
                const [hS, mS] = parseTime(saida);
                const saidaMinutos = hS * 60 + mS;
                const [hTF, mTF] = parseTime(horaFimBase);
                const turnoFimMinutos = hTF * 60 + mTF;

                const diffSaidaRaw = saidaMinutos - turnoFimMinutos;
                const diffSaida = diffSaidaRaw > 720 ? diffSaidaRaw - 1440 : (diffSaidaRaw < -720 ? diffSaidaRaw + 1440 : diffSaidaRaw);

                detalhes.saida.diff_minutos = diffSaida;

                if (diffSaida < 0) status_saida = PONTO_STATUS.ANTECIPADA;
                else if (diffSaida === 0) status_saida = PONTO_STATUS.VERDE;
                else if (diffSaida <= limiteHEExcessiva) status_saida = PONTO_STATUS.AMARELO;
                else status_saida = PONTO_STATUS.VERMELHO;

                const start = new Date(entrada).getTime();
                const end = new Date(saida).getTime();
                const brutoMinutos = Math.round((end - start) / 60000);

                const liquidoMinutos = brutoMinutos - Math.max(pausasMinutos, tolPausa);

                detalhes.resumo.horas_trabalhadas = `${Math.floor(liquidoMinutos / 60)}h ${liquidoMinutos % 60}min`;
                detalhes.resumo.pausa_total = pausasMinutos;
                detalhes.resumo.pausa_configurada = tolPausa;
                detalhes.resumo.pausa_extra = Math.max(0, pausasMinutos - tolPausa);

                let esperadoMinutosBruto = turnoFimMinutos - turnoInicioMinutos;
                if (esperadoMinutosBruto < 0) esperadoMinutosBruto += 1440;

                const esperadoMinutosLiquido = esperadoMinutosBruto - tolPausa;
                saldo_minutos = liquidoMinutos - esperadoMinutosLiquido;
            }
        } else if (saida) {
            const start = new Date(entrada).getTime();
            const end = new Date(saida).getTime();
            const liquidoMinutos = Math.round((end - start) / 60000) - pausasMinutos;
            detalhes.resumo.horas_trabalhadas = `${Math.floor(liquidoMinutos / 60)}h ${liquidoMinutos % 60}min`;
        }

        return {
            status_entrada,
            status_saida,
            detalhes_calculo: detalhes,
            saldo_minutos,
            melhorTurno
        };
    }
};
