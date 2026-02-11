import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { TimeRecordRules } from "../utils/timeRecordRules.js";
import { configuracaoService } from "./configuracao.service.js";

// Interface para Pausa
interface PausaPayload {
    ponto_id: number;
    inicio_hora?: string;
    fim_hora?: string;
    inicio_km?: number;
    fim_km?: number;
    inicio_loc?: any;
    fim_loc?: any;
}

// Helper para calcular status
// Helper para calcular status
// Helper para extrair HH e MM de string (ISO ou HH:mm)
function parseTime(timeStr: string): [number, number] {
    if (!timeStr) return [0, 0];
    
    if (timeStr.includes("T")) {
        // Formato ISO: 2025-12-26T08:00:00-03:00
        // Problema: Em ambiente UTC (Vercel), new Date().getHours() retorna UTC.
        // Solução: Forçar extração no fuso horário America/Sao_Paulo.
        const date = new Date(timeStr);
        const options: Intl.DateTimeFormatOptions = { 
            timeZone: 'America/Sao_Paulo', 
            hour: 'numeric', 
            minute: 'numeric', 
            hour12: false 
        };
        // Intl retorna "13:12" ou "01:12" dependendo do locale, mas pt-BR + hour12: false garante 24h
        const formatter = new Intl.DateTimeFormat('pt-BR', options);
        const parts = formatter.format(date).split(':');
        return [Number(parts[0]), Number(parts[1])];
    } else if (timeStr.includes(":")) {
        // Formato HH:mm ou HH:mm:ss (vindo do Banco/Turno, assumimos que já é "Wall Time" correto)
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
    saida_km?: number | null,
    pausasMinutos: number = 0
): Promise<{ status_entrada: string; status_saida: string; detalhes_calculo: any; saldo_minutos: number | null; melhorTurno?: any }> {
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

    // 2. Buscar turnos (Links: ColaboradorCliente)
    const { data: turnos, error: turnoError } = await supabaseAdmin
        .from("colaborador_clientes")
        .select("*")
        .eq("colaborador_id", usuarioId);

    if (turnoError) console.error(messages.ponto.erro.buscarTurnos, turnoError);

    let melhorTurno: any = null;
    let menorDiffInicio = Infinity;

    // Helper inside
    if (turnos && turnos.length > 0) {
        const [hEntrada, mEntrada] = parseTime(entrada);
        const entradaMinutos = hEntrada * 60 + mEntrada;

        turnos.forEach(turno => {
             // Turno agora vem de colaborador_clientes, formato HH:mm:ss
            const [hTurno, mTurno] = parseTime(turno.hora_inicio);
            const turnoMinutos = hTurno * 60 + mTurno;
            const diff = Math.abs(entradaMinutos - turnoMinutos);
            if (diff < menorDiffInicio) {
                menorDiffInicio = diff;
                melhorTurno = turno;
            }
        });
    }

    // ... (rest of function)

    return { 
        status_entrada, 
        status_saida, 
        detalhes_calculo: detalhes, 
        saldo_minutos,
        melhorTurno // EXPOSE FOUND SHIFT
    };
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
                // throw new Error("Conflito de horário: Já existe um registro neste turno.");
            }
        }

        // 3. Calcular status e detalhes antes de salvar
        const { status_entrada, status_saida, detalhes_calculo, saldo_minutos, melhorTurno } = await calculateStatus(
            data.usuario_id, 
            data.entrada_hora, 
            data.saida_hora,
            data.entrada_km,
            data.saida_km
        );

        // SMART LINKING: If no client provided, use the one from Best Shift
        let finalClienteId = data.cliente_id;
        let finalEmpresaId = data.empresa_id;

        if (!finalClienteId && melhorTurno) {
            finalClienteId = melhorTurno.cliente_id;
            finalEmpresaId = melhorTurno.empresa_id;
        }

        const payload = {
            ...data,
            entrada_km: data.entrada_km ?? null, 
            saida_km: data.saida_km ?? null,
            status_entrada,
            status_saida: data.saida_hora ? (data.status_saida || status_saida) : null,
            detalhes_calculo,
            saldo_minutos,
            cliente_id: finalClienteId,
            empresa_id: finalEmpresaId,
            entrada_loc: data.entrada_loc || null,
            saida_loc: data.saida_loc || null
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

             // Calculate Pauses Duration
             const { data: pausas } = await supabaseAdmin
                 .from("registros_pausas")
                 .select("inicio_hora, fim_hora")
                 .eq("ponto_id", id)
                 .not("fim_hora", "is", null);
                 
             let totalPausas = 0;
             if (pausas && pausas.length > 0) {
                 totalPausas = pausas.reduce((acc, p) => {
                     const start = new Date(p.inicio_hora).getTime();
                     const end = new Date(p.fim_hora).getTime();
                     return acc + ((end - start) / 60000);
                 }, 0);
             }

             const { status_entrada, status_saida, detalhes_calculo, saldo_minutos } = await calculateStatus(
                existing.usuario_id, 
                entrada, 
                saida,
                entradaKm,
                saidaKm,
                Math.round(totalPausas)
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
            .select("*, usuario:usuarios!registros_ponto_usuario_id_fkey(*), pausas:registros_pausas(*)")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    async listPontos(filtros?: any): Promise<any[]> {
        let query = supabaseAdmin
            .from("registros_ponto")
            // Explicitly specifying the FK constraint to avoid ambiguity with 'criado_por'
            // Fetch embedded links to get client info
            .select("*, usuario:usuarios!registros_ponto_usuario_id_fkey!inner(*, links:colaborador_clientes(cliente:clientes(nome_fantasia))), pausas:registros_pausas(*)")
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
             // Search by User Name or CPF (Client search via deep relation is complex here, keeping robust)
             query = query.or(`usuario.nome_completo.ilike.%${filtros.searchTerm}%,usuario.cpf.ilike.%${filtros.searchTerm}%`);
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
            .select("*, cliente:clientes(*), pausas:registros_pausas(*)")
            .eq("usuario_id", usuarioId)
            .eq("data_referencia", hoje)
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data;
    },

    async togglePonto(usuarioId: string, location?: any): Promise<{ action: 'OPEN' | 'CLOSE', record: any }> {
        // 1. Buscar último registro
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
                    saida_hora: nowDesc,
                    saida_loc: location
                });
                return { action: 'CLOSE', record: updated };
            }
        } 
        
        // Cenário B: Turno Fechado, Inexistente, ou Aberto > 16h -> ABRIR
        const dataRef = nowDesc.split('T')[0];
        const newRecord = await this.registrarPonto({
            usuario_id: usuarioId,
            data_referencia: dataRef,
            entrada_hora: nowDesc,
            saida_hora: null,
            criado_por: usuarioId,
            entrada_loc: location
        });
        return { action: 'OPEN', record: newRecord };
    },

    async deletePonto(id: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from("registros_ponto")
            .delete()
            .eq("id", id);
            
        if (error) throw error;
    },

    // --- PAUSAS ---

    async iniciarPausa(data: PausaPayload): Promise<any> {
        if (!data.ponto_id) throw new Error(messages.ponto.erro.idPontoObrigatorio);
        if (!data.inicio_hora) data.inicio_hora = new Date().toISOString();

        // Check if there is already an open pause?
        const { data: openPausa } = await supabaseAdmin
            .from("registros_pausas")
            .select("*")
            .eq("ponto_id", data.ponto_id)
            .is("fim_hora", null)
            .maybeSingle();
            
        if (openPausa) throw new Error(messages.ponto.erro.pausaAberta);

        const { data: inserted, error } = await supabaseAdmin
            .from("registros_pausas")
            .insert([{
                ponto_id: data.ponto_id,
                inicio_hora: data.inicio_hora,
                inicio_km: data.inicio_km,
                inicio_loc: data.inicio_loc
            }])
            .select()
            .single();

        if (error) throw error;
        return inserted;
    },

    async finalizarPausa(id: number, data: Partial<PausaPayload>): Promise<any> {
        if (!data.fim_hora) data.fim_hora = new Date().toISOString();
        
        const { data: updated, error } = await supabaseAdmin
            .from("registros_pausas")
            .update({
                fim_hora: data.fim_hora,
                fim_km: data.fim_km,
                fim_loc: data.fim_loc
            })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        
        // Trigger generic update on Ponto to recalculate balance (saldo_minutos)
        if (updated?.ponto_id) {
            await this.updatePonto(updated.ponto_id, {});
        }

        return updated;
    },

    async getPausas(pontoId: number): Promise<any[]> {
        const { data, error } = await supabaseAdmin
             .from("registros_pausas")
             .select("*")
             .eq("ponto_id", pontoId)
             .order("inicio_hora", { ascending: true });
             
        if (error) throw error;
        return data || [];
    }
};
