/**
 * Serviço de cache em memória para ausências marcadas manualmente.
 * Mantém apenas os dados da data atualmente sendo visualizada para economizar memória.
 */
const manualAbsences = new Map<string, Set<string>>();

export const ManualAbsenceService = {
  add(date: string, userId: string): void {
    if (!manualAbsences.has(date)) {
      manualAbsences.clear();
      manualAbsences.set(date, new Set());
    }
    manualAbsences.get(date)?.add(userId);
  },

  remove(date: string, userId: string): void {
    manualAbsences.get(date)?.delete(userId);
  },

  list(date: string): string[] {
    const ids = manualAbsences.get(date);
    return ids ? Array.from(ids) : [];
  }
};
