-- --- MIGRATION: RECORRENCIA DE DESPESAS OPERACIONAIS E INDICES ---
-- Timestamp: 20261022100000

ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS recorrencia_origem_id UUID REFERENCES public.despesas_operacionais(id) ON DELETE CASCADE;
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS dia_vencimento_base INTEGER;

CREATE INDEX IF NOT EXISTS idx_despesas_recorrencia_origem 
ON public.despesas_operacionais (recorrencia_origem_id) 
WHERE recorrencia_origem_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_is_recorrente 
ON public.despesas_operacionais (is_recorrente) 
WHERE is_recorrente = true;
