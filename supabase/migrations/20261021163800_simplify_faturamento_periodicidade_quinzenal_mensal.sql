-- --- MIGRATION: SIMPLIFICAR PERIODICIDADE PARA QUINZENAL E MENSAL ---
-- Timestamp: 20261021163800

-- 1. Normalizar registros existentes de SEMANAL para QUINZENAL
UPDATE public.clientes
SET periodicidade = 'QUINZENAL'
WHERE periodicidade = 'SEMANAL';

UPDATE public.faturas_clientes
SET tipo_periodo = 'QUINZENAL'
WHERE tipo_periodo = 'SEMANAL';

-- 2. Limpar quinzena em faturas mensais para não colidir em filtros
UPDATE public.faturas_clientes
SET quinzena = NULL
WHERE tipo_periodo = 'MENSAL';

-- 3. Atualizar restrições de validação para permitir apenas QUINZENAL e MENSAL
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_periodicidade_check;

ALTER TABLE public.clientes ADD CONSTRAINT clientes_periodicidade_check
    CHECK (periodicidade IN ('QUINZENAL', 'MENSAL'));

ALTER TABLE public.faturas_clientes DROP CONSTRAINT IF EXISTS faturas_clientes_tipo_periodo_check;

ALTER TABLE public.faturas_clientes ADD CONSTRAINT faturas_clientes_tipo_periodo_check
    CHECK (tipo_periodo IN ('QUINZENAL', 'MENSAL'));
