import { Pausa, RegistroPonto } from "../types/database.js";

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

/**
 * Converte uma string para um formato de slug/nome interno (lowercase, sem espaços, sem acentos)
 */
export function slugify(value: string): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

/**
 * Remove todos os caracteres que não são dígitos de uma string.
 * Útil para limpar CPFs, CNPJs, CEPs, etc antes de enviar para o banco.
 */
export function onlyNumbers(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value.toString().replace(/\D/g, "");
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

export function formatPausa(pa: Pausa): Pausa {
  if (!pa) return pa;
  return {
    ...pa,
    inicio_hora: pa.inicio_hora ? toBRTime(pa.inicio_hora) : "",
    fim_hora: pa.fim_hora ? toBRTime(pa.fim_hora) : null,
    created_at: pa.created_at ? toBRTime(pa.created_at) : undefined,
    updated_at: pa.updated_at ? toBRTime(pa.updated_at) : undefined
  };
}

export function formatPoint(p: Partial<RegistroPonto> | RegistroPonto): RegistroPonto {
  if (!p) return p as RegistroPonto;
  const result = { ...p } as RegistroPonto;
  if (result.entrada_hora) result.entrada_hora = toBRTime(result.entrada_hora);
  if (result.saida_hora) result.saida_hora = toBRTime(result.saida_hora);
  if (result.created_at) result.created_at = toBRTime(result.created_at);
  if (result.updated_at) result.updated_at = toBRTime(result.updated_at);
  if (result.pausas && Array.isArray(result.pausas)) {
    result.pausas = result.pausas.map(formatPausa);
  }
  return result;
}

/**
 * Retorna o dia da semana (0-6, onde 0 é Domingo) no timezone de Brasília
 */
export const getDayOfWeekBR = (dateInput: string | Date): number => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (!date || isNaN(date.getTime())) return NaN;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  });

  const parts = formatter.formatToParts(date);
  const p: any = {};
  parts.forEach(part => p[part.type] = part.value);

  // Mês no JS é 0-11
  const localDate = new Date(Number(p.year), Number(p.month) - 1, Number(p.day), 12, 0, 0);
  return localDate.getDay();
};