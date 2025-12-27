interface Turno {
    hora_inicio: string;
    hora_fim: string;
}

// Renamed to generic validateShifts
export const validateShifts = (turnos: Turno[]) => {
    if (!turnos || turnos.length === 0) return;

    const toMinutes = (time: string) => {
        const [h, m] = time.split(":").map(Number);
        return h * 60 + m;
    };

    const formatTime = (t: string) => t.substring(0, 5);

    // 1. Validate Individual Shifts
    for (const t of turnos) {
        const start = toMinutes(t.hora_inicio);
        const end = toMinutes(t.hora_fim);
        
        let duration = 0;
        if (start < end) {
            duration = end - start;
        } else {
            // Overnight shift (e.g. 22:00 to 05:00)
            // 22:00 to 24:00 (120m) + 00:00 to 05:00 (300m) = 420m
            duration = (1440 - start) + end;
        }

        if (duration < 60) {
            throw new Error(`Duração inválida no turno ${formatTime(t.hora_inicio)}-${formatTime(t.hora_fim)}: O turno deve ter no mínimo 1 hora de duração.`);
        }
    }

    // 2. Validate Overlaps
    if (turnos.length > 1) {
        // Helper to get intervals [start, end] from a shift
        const getIntervals = (t: Turno) => {
            const start = toMinutes(t.hora_inicio);
            const end = toMinutes(t.hora_fim);
            if (start < end) {
                return [[start, end]];
            } else {
                // Overnight: [Start, 1440] AND [0, End]
                return [[start, 1440], [0, end]];
            }
        };

        for (let i = 0; i < turnos.length; i++) {
            for (let j = i + 1; j < turnos.length; j++) {
                const t1 = turnos[i];
                const t2 = turnos[j];
                
                const intervals1 = getIntervals(t1);
                const intervals2 = getIntervals(t2);

                for (const [s1, e1] of intervals1) {
                    for (const [s2, e2] of intervals2) {
                        // Check intersection
                        if (s1 < e2 && s2 < e1) {
                             throw new Error(`Conflito de horário detectado: ${formatTime(t1.hora_inicio)}-${formatTime(t1.hora_fim)} coincide com ${formatTime(t2.hora_inicio)}-${formatTime(t2.hora_fim)}`);
                        }
                    }
                }
            }
        }
    }
};
