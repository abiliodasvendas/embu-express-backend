-- --- MIGRATION: REFACTOR CONTRATOS CLIENTES, STATUS FATURAS E DESPESAS PARCELADAS ---
-- Timestamp: 20261021174500

-- 1. Clientes: Coluna de Valor do Contrato Mensal (sincronizada com valor_base legado)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS valor_contrato_mensal NUMERIC(12, 2) DEFAULT 0;

UPDATE public.clientes
SET valor_contrato_mensal = COALESCE(valor_base, 0)
WHERE valor_contrato_mensal IS NULL OR valor_contrato_mensal = 0;

-- 2. Faturas Clientes: Enxugamento dos Status para 4 opções operacionais
-- Migrar status legados antes de aplicar o novo CHECK
UPDATE public.faturas_clientes
SET status = 'PENDENTE'
WHERE status IN ('EM_MEDICAO', 'AGUARDANDO_APROVACAO', 'EMITIDA_PENDENTE') OR status IS NULL;

ALTER TABLE public.faturas_clientes DROP CONSTRAINT IF EXISTS faturas_clientes_status_check;

ALTER TABLE public.faturas_clientes ADD CONSTRAINT faturas_clientes_status_check
    CHECK (status IN ('PENDENTE', 'PAGO_PARCIAL', 'LIQUIDADA', 'CANCELADA'));

-- 3. Despesas Operacionais: Suporte a Parcelamento e Recorrência
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS grupo_parcelamento_id UUID;
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS numero_parcela INTEGER;
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS total_parcelas INTEGER;
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS is_recorrente BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_despesas_grupo_parcelamento 
ON public.despesas_operacionais (grupo_parcelamento_id) 
WHERE grupo_parcelamento_id IS NOT NULL;
