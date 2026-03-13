export const FINANCEIRO_STATUS = {
    RASCUNHO: 'RASCUNHO',
    PAGO: 'PAGO',
} as const;

export const LANCAMENTO_TIPO = {
    ENTRADA: 'ENTRADA',
    SAIDA: 'SAIDA',
} as const;

export const PIX_TYPES = {
    CPF: 'CPF',
    CNPJ: 'CNPJ',
    EMAIL: 'EMAIL',
    TELEFONE: 'TELEFONE',
    ALEATORIA: 'ALEATORIA',
} as const;

export type PixType = keyof typeof PIX_TYPES;