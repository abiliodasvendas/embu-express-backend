/**
 * Serviço de cache em memória para ausências marcadas manualmente.
 * Mantém apenas os dados da data atualmente sendo visualizada para economizar memória.
 */
const manualAbsences = new Map<string, Set<string>>();

const formatDate = (date: Date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const cleanup = (activeDate: string) => {
  const now = new Date();
  const today = formatDate(now);
  const yesterday = formatDate(new Date(now.getTime() - 86400000));

  for (const key of manualAbsences.keys()) {
    // Mantém hoje, ontem e a data que está sendo manipulada no momento
    if (key !== today && key !== yesterday && key !== activeDate) {
      manualAbsences.delete(key);
    }
  }
};

export const ManualAbsenceService = {
  add(date: string, userId: string): void {
    cleanup(date);
    if (!manualAbsences.has(date)) {
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
