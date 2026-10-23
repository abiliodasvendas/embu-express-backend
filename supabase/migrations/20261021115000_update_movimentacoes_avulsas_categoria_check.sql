-- Migration: Atualizar constraint de categorias em movimentacoes_avulsas
-- Timestamp: 20261021115000

ALTER TABLE public.movimentacoes_avulsas DROP CONSTRAINT IF EXISTS movimentacoes_avulsas_categoria_check;

ALTER TABLE public.movimentacoes_avulsas ADD CONSTRAINT movimentacoes_avulsas_categoria_check CHECK (
    categoria IN (
        'FRETE_ESPORADICO',
        'RENDIMENTO_APLICACAO',
        'REEMBOLSO_CLIENTE',
        'DOACAO_APORTE',
        'OUTRAS_ENTRADAS',
        'DESPESA_OPERACIONAL_AVULSA',
        'REEMBOLSO_DESPESA',
        'TARIFA_BANCARIA',
        'OUTRAS_SAIDAS',
        'CLIENTE_A_VISTA',
        'REEMBOLSO',
        'OUTRAS_RECEITAS',
        'OUTRAS_DESPESAS'
    )
);
