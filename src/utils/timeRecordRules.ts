import { messages } from "../constants/messages.js";

export class TimeRecordRules {
    /**
     * Valida se a ordem cronológica dos horários está correta.
     * Considera a possibilidade de virada de noite (shift overnight).
     * @param entrada ISO string
     * @param saida ISO string (opcional)
     * @returns { valid: boolean, message?: string }
     */
    static validateTimeOrder(entrada: string, saida?: string | null): { valid: boolean, message?: string } {
        if (!saida) return { valid: true };

        const start = new Date(entrada);
        const end = new Date(saida);

        // Se a data de saída for anterior à entrada (erro grosseiro de data)
        if (end.getTime() < start.getTime()) {
            // Tenta verificar se foi apenas um erro de input de hora virando o dia
            // Mas o ISO já deve vir corrigido do frontend/service.
            // Se chegou aqui com timestamp menor, é erro.
            return { valid: false, message: messages.ponto.erro.ordemInvalida };
        }

        return { valid: true };
    }

    /**
     * Valida duração mínima do registro.
     * @param entrada 
     * @param saida 
     * @param minMinutes Default 1 minute
     */
    static validateMinDuration(entrada: string, saida: string | null, minMinutes = 60): { valid: boolean, message?: string } {
        if (!saida) return { valid: true };

        const start = new Date(entrada);
        const end = new Date(saida);
        const diffMs = end.getTime() - start.getTime();
        const diffMinutes = diffMs / (1000 * 60);

        if (diffMinutes < minMinutes) {
            return { valid: false, message: messages.ponto.erro.duracaoMinima.replace("{min}", minMinutes.toString()) };
        }

        return { valid: true };
    }

    /**
     * Valida duração máxima do registro (ex: 16h).
     * Evita turnos absurdos por erro de digitação.
     */
    static validateMaxDuration(entrada: string, saida: string | null, maxHours = 16): { valid: boolean, message?: string } {
        if (!saida) return { valid: true };

        const start = new Date(entrada);
        const end = new Date(saida);
        const diffMs = end.getTime() - start.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours > maxHours) {
            return { valid: false, message: messages.ponto.erro.duracaoMaxima.replace("{max}", maxHours.toString()) };
        }

        return { valid: true };
    }

    /**
     * Verifica sobreposição de horários.
     * @param newStart 
     * @param newEnd 
     * @param existingRecords Lista de registros EXISTENTES do usuário no mesmo dia/turno
     */
    static checkOverlap(newStart: Date, newEnd: Date | null, existingRecords: any[]): { hasOverlap: boolean, conflictRecord?: any } {
        if (!existingRecords || existingRecords.length === 0) return { hasOverlap: false };

        const startMs = newStart.getTime();
        const endMs = newEnd ? newEnd.getTime() : Infinity; // Se aberto, considera infinito (ou até agora/fim do dia)

        for (const reg of existingRecords) {
            const regStart = new Date(reg.entrada_hora).getTime();
            const regEnd = reg.saida_hora ? new Date(reg.saida_hora).getTime() : Infinity;

            // Lógica de Overlap: (StartA < EndB) && (EndA > StartB)
            // Se um dos dois for infinito, a lógica se mantém (Infinity > qualquer hora)
            if (startMs < regEnd && endMs > regStart) {
                return { hasOverlap: true, conflictRecord: reg };
            }
        }

        return { hasOverlap: false };
    }
}
