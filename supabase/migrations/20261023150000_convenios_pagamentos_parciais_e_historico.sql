-- Migration: Suporte a Pagamentos Parciais (Adiantamentos) e Histórico de Pagamentos de Convênios
-- Timestamp: 20261023150000

-- 1. Atualizar constraint de status para permitir 'PAGO_PARCIAL' e 'CANCELADA'
ALTER TABLE public.faturas_fornecedores_convenios 
    DROP CONSTRAINT IF EXISTS faturas_fornecedores_convenios_status_check;

ALTER TABLE public.faturas_fornecedores_convenios 
    ADD CONSTRAINT faturas_fornecedores_convenios_status_check 
    CHECK (status IN ('PENDENTE', 'PAGO_PARCIAL', 'PAGA', 'CANCELADA', 'EM_AUDITORIA', 'APROVADA', 'GLOSADA'));

-- 2. Criar tabela de histórico de pagamentos de faturas de convênios
CREATE TABLE IF NOT EXISTS public.faturas_fornecedores_pagamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fatura_fornecedor_id UUID NOT NULL REFERENCES public.faturas_fornecedores_convenios(id) ON DELETE CASCADE,
    conta_bancaria_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
    empresa_id BIGINT REFERENCES public.empresas(id) ON DELETE SET NULL,
    data_pagamento DATE NOT NULL,
    valor_pago NUMERIC(10,2) NOT NULL CHECK (valor_pago > 0),
    observacao TEXT,
    comprovante_url TEXT,
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.faturas_fornecedores_pagamentos OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_faturas_forn_pag_fatura 
ON public.faturas_fornecedores_pagamentos (fatura_fornecedor_id);

CREATE INDEX IF NOT EXISTS idx_faturas_forn_pag_data 
ON public.faturas_fornecedores_pagamentos (data_pagamento);

GRANT ALL ON TABLE public.faturas_fornecedores_pagamentos TO anon, authenticated, service_role;

-- 3. Migrar dados históricos de quitações preexistentes para a nova tabela
INSERT INTO public.faturas_fornecedores_pagamentos (
    fatura_fornecedor_id,
    conta_bancaria_id,
    empresa_id,
    data_pagamento,
    valor_pago,
    observacao,
    created_at
)
SELECT 
    f.id,
    f.conta_bancaria_id,
    f.empresa_id,
    COALESCE(f.data_pagamento, CURRENT_DATE),
    f.valor_pago,
    'Migração de quitação preexistente',
    f.created_at
FROM public.faturas_fornecedores_convenios f
WHERE f.valor_pago > 0 AND f.status = 'PAGA'
  AND NOT EXISTS (
    SELECT 1 FROM public.faturas_fornecedores_pagamentos p WHERE p.fatura_fornecedor_id = f.id
  );
