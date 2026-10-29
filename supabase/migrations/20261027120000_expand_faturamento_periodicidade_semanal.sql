-- --- MIGRATION: EXPANDIR PERIODICIDADE PARA SUPORTAR SEMANAL, QUINZENAL E MENSAL ---
-- Timestamp: 20261027120000

-- 1. Atualizar restrição de periodicidade na tabela clientes para permitir SEMANAL
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_periodicidade_check;

ALTER TABLE public.clientes ADD CONSTRAINT clientes_periodicidade_check
    CHECK (periodicidade IN ('QUINZENAL', 'MENSAL', 'SEMANAL'));

-- 2. Atualizar restrição de tipo_periodo na tabela faturas_clientes para permitir SEMANAL
ALTER TABLE public.faturas_clientes DROP CONSTRAINT IF EXISTS faturas_clientes_tipo_periodo_check;

ALTER TABLE public.faturas_clientes ADD CONSTRAINT faturas_clientes_tipo_periodo_check
    CHECK (tipo_periodo IN ('QUINZENAL', 'MENSAL', 'SEMANAL'));

-- 3. Garantir suporte a semanas de 1 a 5 na unicidade de faturas
CREATE UNIQUE INDEX IF NOT EXISTS idx_faturas_clientes_unicidade_periodo 
ON public.faturas_clientes (cliente_id, mes_competencia, ano_competencia, tipo_periodo, numero_periodo);

-- 4. Permitir NULL e default na coluna quinzena para faturas mensais e semanais
ALTER TABLE public.faturas_clientes ALTER COLUMN quinzena DROP NOT NULL;
ALTER TABLE public.faturas_clientes ALTER COLUMN quinzena SET DEFAULT 1;
