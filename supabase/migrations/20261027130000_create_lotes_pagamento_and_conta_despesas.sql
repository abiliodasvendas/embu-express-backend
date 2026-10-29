-- --- MIGRATION: LOTES PAGAMENTO, CONTA BANCARIA EM DESPESAS E RASTREABILIDADE ---
-- Timestamp: 20261027130000

-- 1. Vincular conta bancária a despesas operacionais
ALTER TABLE public.despesas_operacionais 
ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID REFERENCES public.contas_bancarias(id);

-- 2. Tabela de Lotes de Pagamento (Contas a Pagar em Lote)
CREATE TABLE IF NOT EXISTS public.lotes_pagamento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conta_bancaria_origem_id UUID NOT NULL REFERENCES public.contas_bancarias(id),
    data_pagamento DATE NOT NULL,
    valor_total_pago NUMERIC(12, 2) NOT NULL,
    observacao TEXT,
    criado_por UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Vincular despesas e faturas de convênio ao lote de pagamento
ALTER TABLE public.despesas_operacionais 
ADD COLUMN IF NOT EXISTS lote_pagamento_id UUID REFERENCES public.lotes_pagamento(id);

ALTER TABLE public.faturas_fornecedores_convenios 
ADD COLUMN IF NOT EXISTS lote_pagamento_id UUID REFERENCES public.lotes_pagamento(id);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_despesas_conta_bancaria ON public.despesas_operacionais(conta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_despesas_lote_pagamento ON public.despesas_operacionais(lote_pagamento_id);
CREATE INDEX IF NOT EXISTS idx_faturas_convenio_lote_pagamento ON public.faturas_fornecedores_convenios(lote_pagamento_id);
