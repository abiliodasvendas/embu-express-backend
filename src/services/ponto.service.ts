import { supabaseAdmin } from "../config/supabase.js";
import { TimeRecordRules } from "../utils/timeRecordRules.js";
import { configuracaoService } from "./configuracao.service.js";

// Helper para calcular status
// Helper para calcular status
// Helper para extrair HH e MM de string (ISO ou HH:mm)
// Helper para extrair HH e MM de string (ISO ou HH:mm)
function parseTime(timeStr: string): [number, number] {
    if (timeStr.includes("T")) {
        // Formato ISO: 2025-12-26T08:00:00-03:00
        const date = new Date(timeStr);
        return [date.getHours(), date.getMinutes()];
    } else if (timeStr.includes(":")) {
        // Formato HH:mm ou HH:mm:ss
        const [h, m] = timeStr.split(":").map(Number);
        return [h, m];
    }
    return [0, 0]; // Fallback
}

// Helper para calcular status e detalhes
async function calculateStatus(
    usuarioId: string, 
    entrada: string | null | undefined, 
    saida: string | null | undefined,
    entrada_km?: number | null,
    saida_km?: number | null
): Promise<{ status_entrada: string; status_saida: string; detalhes_calculo: any; saldo_minutos: number | null }> {
    // Default values
    let status_entrada = "CINZA";
    let status_saida = "CINZA"; 
    let saldo_minutos: number | null = null;

    const detalhes: any = {
        entrada: { turno_base: null, diff_minutos: 0, tolerancia: 0 },
        saida: { turno_base: null, diff_minutos: 0, tolerancia: 0 },
        resumo: {} // Novo objeto para dados extras
    };
    
    // Calculo básico de KM (sem regras complexas por enquanto)
    if (entrada_km != null && saida_km != null) {
        detalhes.resumo.diff_km = saida_km - entrada_km;
    }

    if (!entrada) return { status_entrada, status_saida, detalhes_calculo: detalhes, saldo_minutos };

    // ... (config and shift fetching remains similar, just condensed here for context if needed, but only replacing logic)
    // 1. Buscar configurações
    const toleranciaVerde = await configuracaoService.getConfiguracao("tolerancia_verde_min").then(d => Number(d?.valor || 5));
    const limiteAmarelo = await configuracaoService.getConfiguracao("tolerancia_amarelo_min").then(d => Number(d?.valor || 15));
    const toleranciaSaida = await configuracaoService.getConfiguracao("tolerancia_saida_min").then(d => Number(d?.valor || 10)); 
    const limiteHoraExtra = await configuracaoService.getConfiguracao("limite_he_excessiva_min").then(d => Number(d?.valor || 120)); 

    detalhes.entrada.tolerancia = limiteAmarelo;
    detalhes.saida.tolerancia = toleranciaSaida;

    // 2. Buscar turnos
    const { data: turnos, error: turnoError } = await supabaseAdmin
        .from("usuario_turnos")
        .select("*")
        .eq("usuario_id", usuarioId);

    if (turnoError) console.error("Erro ao buscar turnos:", turnoError);

    let melhorTurno: any = null;
    let menorDiffInicio = Infinity;

    // Helper inside
    if (turnos && turnos.length > 0) {
        const [hEntrada, mEntrada] = parseTime(entrada);
        const entradaMinutos = hEntrada * 60 + mEntrada;

        turnos.forEach(turno => {
            const [hTurno, mTurno] = parseTime(turno.hora_inicio);
            const turnoMinutos = hTurno * 60 + mTurno;
            const diff = Math.abs(entradaMinutos - turnoMinutos);
            if (diff < menorDiffInicio) {
                menorDiffInicio = diff;
                melhorTurno = turno;
            }
        });
    }

    // Dates for calculation
    let entradaDate: Date | null = null;
    let saidaDate: Date | null = null;
    let turnoInicioDate: Date | null = null;
    let turnoFimDate: Date | null = null;

    // 3. Calcular Entrada
    if (melhorTurno) {
        const [hTurno, mTurno] = parseTime(melhorTurno.hora_inicio);
        const [hEntrada, mEntrada] = parseTime(entrada);
        
        detalhes.entrada.turno_base = melhorTurno.hora_inicio;
        
        const tDate = new Date(); tDate.setHours(hTurno, mTurno, 0, 0);
        const eDate = new Date(); eDate.setHours(hEntrada, mEntrada, 0, 0);
        turnoInicioDate = tDate;
        entradaDate = eDate;

        let diffMinutes = (eDate.getTime() - tDate.getTime()) / 60000;
        
        if (diffMinutes <= toleranciaVerde) {
             status_entrada = "VERDE";
        } else if (diffMinutes > limiteAmarelo) {
             status_entrada = "VERMELHO";
        } else {
             status_entrada = "AMARELO";
        }
        detalhes.entrada.diff_minutos = Math.round(diffMinutes);
    }

    // 4. Calcular Saída e Saldo
    if (saida && melhorTurno && entradaDate && turnoInicioDate) {
         const [hTurnoFim, mTurnoFim] = parseTime(melhorTurno.hora_fim);
         const [hSaida, mSaida] = parseTime(saida);
         
         detalhes.saida.turno_base = melhorTurno.hora_fim;

         const tFimDate = new Date(); tFimDate.setHours(hTurnoFim, mTurnoFim, 0, 0);
         const sDate = new Date(); sDate.setHours(hSaida, mSaida, 0, 0);
         
         // Ajuste virada de noite (Saída)
         // Se saida < inicio (virou o dia) ou se turno fim < turno inicio
         // Logica simplificada: comparar com entrada.
         if (sDate < entradaDate) sDate.setDate(sDate.getDate() + 1);
         if (tFimDate < turnoInicioDate) tFimDate.setDate(tFimDate.getDate() + 1);

         // Garantir que Saida Real seja depois da Entrada Real (mesmo que seja no proximo dia)
         // Ex: Entrou 22:00, Saiu 05:00. 
         if (hSaida < parseTime(entrada)[0]) {
             // Se a hora da saida é menor que a entrada, assumimos dia seguinte
              // Já tratado pelo 'if sDate < entradaDate' mas reforçando se for no mesmo dia calendario no server
         }
         // Melhor: Se sDate <= entradaDate, add 1 dia.
         if(sDate.getTime() <= entradaDate.getTime()) {
             sDate.setDate(sDate.getDate() + 1);
         }
         
          // Ajuste virada de noite (Turno)
         if(tFimDate.getTime() <= turnoInicioDate.getTime()) {
             tFimDate.setDate(tFimDate.getDate() + 1);
         }

         saidaDate = sDate;
         turnoFimDate = tFimDate;

         const diffMinutes = (sDate.getTime() - tFimDate.getTime()) / 60000;

         if (diffMinutes > limiteHoraExtra) {
             status_saida = "VERMELHO"; 
         } else if (diffMinutes > toleranciaSaida) {
             status_saida = "AMARELO";
         } else if (diffMinutes < -10) { 
             status_saida = "ANTECIPADA"; // Saida antecipada (Novo status para diferenciar de Hora Extra)
         } else {
             status_saida = "VERDE";
         }
         detalhes.saida.diff_minutos = Math.round(diffMinutes);

         // --- CALCULO DE SALDO ---
         // Duração Real
         const durationActual = (saidaDate.getTime() - entradaDate.getTime()) / 60000;
         // Duração Esperada
         const durationExpected = (turnoFimDate.getTime() - turnoInicioDate.getTime()) / 60000;
         
         saldo_minutos = Math.round(durationActual - durationExpected);

         // Format horas trabalhadas
         const hTrabalhadas = Math.floor(Math.abs(durationActual) / 60);
         const mTrabalhadas = Math.round(Math.abs(durationActual) % 60);
         const strTrabalhadas = `${hTrabalhadas.toString().padStart(2, '0')}:${mTrabalhadas.toString().padStart(2, '0')}`;
         detalhes.resumo.horas_trabalhadas = strTrabalhadas;

    } else if (saida) {
        status_saida = "CINZA";
    }

    return { status_entrada, status_saida, detalhes_calculo: detalhes, saldo_minutos };
}

export const pontoService = {
    async registrarPonto(data: any): Promise<any> {
        // 1. Validações Básicas (Ordem e Duração)
        const orderCheck = TimeRecordRules.validateTimeOrder(data.entrada_hora, data.saida_hora);
        if (!orderCheck.valid) throw new Error(orderCheck.message);

        const durationCheck = TimeRecordRules.validateMinDuration(data.entrada_hora, data.saida_hora);
        if (!durationCheck.valid) throw new Error(durationCheck.message);

        const maxDurationCheck = TimeRecordRules.validateMaxDuration(data.entrada_hora, data.saida_hora);
        if (!maxDurationCheck.valid) throw new Error(maxDurationCheck.message);

        // 2. Validação de Sobreposição
        // Busca simplificada: Registros do mesmo dia (ou +- 1 dia para cobrir viradas)
        // Por segurança, busca registros onde data_referencia bate OU intervalo de tempo cruza.
        // Mas a query por data_referencia é muito mais performática e cobre 99% dos casos manuais.
        const { data: registrosDia, error: fetchError } = await supabaseAdmin
             .from("registros_ponto")
             .select("id, entrada_hora, saida_hora")
             .eq("usuario_id", data.usuario_id)
             .eq("data_referencia", data.data_referencia);
        
        if (fetchError) throw fetchError;

        if (registrosDia && registrosDia.length > 0) {
            const newStart = new Date(data.entrada_hora);
            const newEnd = data.saida_hora ? new Date(data.saida_hora) : null;
            
            const overlapCheck = TimeRecordRules.checkOverlap(newStart, newEnd, registrosDia);
            
            if (overlapCheck.hasOverlap) {
                throw new Error("Conflito de horário: Já existe um registro neste turno.");
            }
        }

        // 3. Calcular status e detalhes antes de salvar
        const { status_entrada, status_saida, detalhes_calculo, saldo_minutos } = await calculateStatus(
            data.usuario_id, 
            data.entrada_hora, 
            data.saida_hora,
            data.entrada_km,
            data.saida_km
        );

        const payload = {
            ...data,
            entrada_km: data.entrada_km ?? null, // Permite null se o banco aceitar (após migration)
            saida_km: data.saida_km ?? null,
            status_entrada,
            status_saida: data.saida_hora ? (data.status_saida || status_saida) : null,
            detalhes_calculo,
            saldo_minutos
        };

        const { data: inserted, error } = await supabaseAdmin
            .from("registros_ponto")
            .insert([payload])
            .select();

        if (error) throw error;
        return inserted?.[0];
    },

    async updatePonto(id: number, data: Partial<any>): Promise<any> {
        // If updating times, recalculate status and details
        let payload = { ...data };
        
        if (data.entrada_hora || data.saida_hora) {
             // We need to fetch the existing record if one of the times is missing to calculate correctly? 
             // For simplicity, we assume the frontend sends what is needed or we fetch inside (better).
             const existing = await this.getPonto(id);
             const entrada = data.entrada_hora || existing.entrada_hora;
             const saida = data.saida_hora !== undefined ? data.saida_hora : existing.saida_hora; // Handle explicit null

             const entradaKm = data.entrada_km !== undefined ? data.entrada_km : existing.entrada_km;
             const saidaKm = data.saida_km !== undefined ? data.saida_km : existing.saida_km;

             // Validate Rules before calculation
             if (saida) {
                 const orderCheck = TimeRecordRules.validateTimeOrder(entrada, saida);
                 if (!orderCheck.valid) throw new Error(orderCheck.message);
                 
                 const maxConfirm = TimeRecordRules.validateMaxDuration(entrada, saida);
                 if (!maxConfirm.valid) throw new Error(maxConfirm.message);
             }

             const { status_entrada, status_saida, detalhes_calculo, saldo_minutos } = await calculateStatus(
                existing.usuario_id, 
                entrada, 
                saida,
                entradaKm,
                saidaKm
             );
             
             payload.status_entrada = status_entrada;
             payload.status_saida = status_saida;
             payload.detalhes_calculo = detalhes_calculo;
             payload.saldo_minutos = saldo_minutos;
        }

        const { data: updated, error } = await supabaseAdmin
            .from("registros_ponto")
            .update(payload)
            .eq("id", id)
            .select();
            
        if (error) throw error;
        return updated?.[0];
    },

    async getPonto(id: number): Promise<any> {
        const { data, error } = await supabaseAdmin
            .from("registros_ponto")
            // Explicitly specifying the FK constraint to avoid ambiguity with 'criado_por'
            .select("*, usuario:usuarios!registros_ponto_usuario_id_fkey(*)")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    async listPontos(filtros?: any): Promise<any[]> {
        let query = supabaseAdmin
            .from("registros_ponto")
            // Explicitly specifying the FK constraint to avoid ambiguity with 'criado_por'
            .select("*, usuario:usuarios!registros_ponto_usuario_id_fkey!inner(*, cliente:clientes(*))")
            .order("data_referencia", { ascending: false });

        if (filtros?.data_referencia) {
            query = query.eq("data_referencia", filtros.data_referencia);
        }

        if (filtros?.status_entrada && filtros.status_entrada !== 'todos') {
            query = query.eq("status_entrada", filtros.status_entrada);
        }
        
        if (filtros?.status_saida && filtros.status_saida !== 'todos') {
             if (filtros.status_saida === 'trabalhando') {
                 query = query.is("saida_hora", null);
             } else {
                 query = query.eq("status_saida", filtros.status_saida);
             }
        }

        if (filtros?.usuario_id && filtros.usuario_id !== 'todos') {
            query = query.eq("usuario_id", filtros.usuario_id);
        }

        if (filtros?.searchTerm) {
             // Busca agora é focada no Cliente (Nome Fantasia)
             // Precisamos garantir que o join de cliente também seja !inner para filtrar
             // A sintaxe aninhada as vezes é chata no Supabase/Postgrest JS
             // Tentativa com filtro no join aninhado:
             query = query.ilike("usuario.cliente.nome_fantasia", `%${filtros.searchTerm}%`);
             // Nota: Isso depende do PostgREST suportar filtro profundo na versão atual do Supabase.
             // Se falhar, teremos que ajustar. Mas é a tentativa correta.
        }

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    },
    
    async getPontoHoje(usuarioId: string): Promise<any> {
        const hoje = new Date().toISOString().split('T')[0];
        const { data, error } = await supabaseAdmin
            .from("registros_ponto")
            .select("*")
            .eq("usuario_id", usuarioId)
            .eq("data_referencia", hoje)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async togglePonto(usuarioId: string): Promise<{ action: 'OPEN' | 'CLOSE', record: any }> {
        // 1. Buscar último registro (independente de data para garantir consistência)
        const { data: lastRecord, error } = await supabaseAdmin
            .from("registros_ponto")
            .select("*")
            .eq("usuario_id", usuarioId)
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        const nowSEO = new Date();
        const nowDesc = nowSEO.toISOString(); 

        // Cenário A: Turno Aberto e < 16h -> FECHAR
        if (lastRecord && !lastRecord.saida_hora) {
            const entryDate = new Date(lastRecord.entrada_hora);
            const diffMs = nowSEO.getTime() - entryDate.getTime();
            const diffHours = diffMs / (1000 * 60 * 60);

            // Se for menor que 16h, considera o MESMO turno (saída)
            if (diffHours < 16) {
                const updated = await this.updatePonto(lastRecord.id, {
                    saida_hora: nowDesc
                });
                return { action: 'CLOSE', record: updated };
            }
            // Se for maior que 16h, cai no else (ignora o antigo e abre novo)
        } 
        
        // Cenário B: Turno Fechado, Inexistente, ou Aberto > 16h -> ABRIR
        const dataRef = nowDesc.split('T')[0];
        const newRecord = await this.registrarPonto({
            usuario_id: usuarioId,
            data_referencia: dataRef,
            entrada_hora: nowDesc,
            saida_hora: null,
            criado_por: usuarioId
        });
        return { action: 'OPEN', record: newRecord };
    },

    async deletePonto(id: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("registros_ponto")
            .delete()
            .eq("id", id);
            
        if (error) throw error;
    }
};
