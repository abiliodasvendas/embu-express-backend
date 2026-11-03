-- Migration: Adiciona conta_bancaria_padrao_id na tabela unidades_cliente
-- Timestamp: 20261103162500

ALTER TABLE public.unidades_cliente
ADD COLUMN IF NOT EXISTS conta_bancaria_padrao_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_unidades_cliente_conta_bancaria_padrao_id
ON public.unidades_cliente (conta_bancaria_padrao_id);
