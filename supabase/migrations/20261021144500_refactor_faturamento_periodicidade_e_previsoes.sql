-- --- MIGRATION: REFACTOR FATURAMENTO PERIODICIDADE E PREVISOES ---
-- Timestamp: 20261021144500

-- 1. Clientes: Periodicidade e Dia de Vencimento Padrão
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS periodicidade VARCHAR(50) DEFAULT 'QUINZENAL';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS dia_vencimento_padrao INTEGER DEFAULT 16;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clientes_periodicidade_check'
    ) THEN
        ALTER TABLE public.clientes ADD CONSTRAINT clientes_periodicidade_check 
            CHECK (periodicidade IN ('QUINZENAL', 'MENSAL', 'SEMANAL'));
    END IF;
END $$;

-- 2. Faturas Clientes: Flexibilização de Período e Unicidade
ALTER TABLE public.faturas_clientes DROP CONSTRAINT IF EXISTS faturas_clientes_quinzena_check;

ALTER TABLE public.faturas_clientes ADD COLUMN IF NOT EXISTS tipo_periodo VARCHAR(50) DEFAULT 'QUINZENAL';
ALTER TABLE public.faturas_clientes ADD COLUMN IF NOT EXISTS numero_periodo INTEGER DEFAULT 1;
ALTER TABLE public.faturas_clientes ADD COLUMN IF NOT EXISTS data_inicio_apuracao DATE;
ALTER TABLE public.faturas_clientes ADD COLUMN IF NOT EXISTS data_fim_apuracao DATE;

UPDATE public.faturas_clientes 
SET tipo_periodo = 'QUINZENAL', 
    numero_periodo = COALESCE(quinzena, 1) 
WHERE tipo_periodo IS NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'faturas_clientes_tipo_periodo_check'
    ) THEN
        ALTER TABLE public.faturas_clientes ADD CONSTRAINT faturas_clientes_tipo_periodo_check 
            CHECK (tipo_periodo IN ('QUINZENAL', 'MENSAL', 'SEMANAL'));
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_faturas_clientes_unicidade_periodo 
ON public.faturas_clientes (cliente_id, mes_competencia, ano_competencia, tipo_periodo, numero_periodo);
