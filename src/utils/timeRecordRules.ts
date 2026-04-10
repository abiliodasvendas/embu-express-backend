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
}
