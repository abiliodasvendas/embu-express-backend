export function cleanString(str: string, capitalize = false) {
  if (!str) return "";

  let cleaned = str.trim().replace(/\s+/g, " ");

  if (capitalize) {
    cleaned = cleaned
      .toLowerCase()
      .split(" ")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return cleaned;
}

export const moneyToNumber = (value: string): number => {
  if (!value) return 0;

  const numericString = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  return parseFloat(numericString) || 0;
};

export const toLocalDateString = (date: Date = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  
  const parts = formatter.formatToParts(date);
  const find = (type: string) => parts.find(p => p.type === type)?.value;
  
  return `${find('year')}-${find('month')}-${find('day')}`;
};

export const onlyDigits = (value: string): string => {
  return value.replace(/\D/g, '');
}

/**
 * Retorna a data/hora atual ou uma data específica formatada no timezone de Brasília (-03:00)
 * Formato compatível com ISO 8601: YYYY-MM-DDTHH:mm:ss-03:00
 */
export const getNowBR = (date: Date = new Date()): string => {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const find = (type: string) => parts.find(p => p.type === type)?.value;

  return `${find('year')}-${find('month')}-${find('day')}T${find('hour')}:${find('minute')}:${find('second')}-03:00`;
};

/**
 * Converte uma string de data ou Date para ISO com offset -03:00
 */
export const toBRTime = (dateInput: string | Date): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return getNowBR(date);
};