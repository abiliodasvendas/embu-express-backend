-- Migration: Vinculação de Empresa, Conta Bancária e Quitação em Convênios e Faturas de Fornecedores
ALTER TABLE public.convenios 
    ADD COLUMN IF NOT EXISTS empresa_id BIGINT REFERENCES public.empresas(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;

ALTER TABLE public.faturas_fornecedores_convenios 
    ADD COLUMN IF NOT EXISTS empresa_id BIGINT REFERENCES public.empresas(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS data_pagamento DATE,
    ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(10,2) DEFAULT 0;
