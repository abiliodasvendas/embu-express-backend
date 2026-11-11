ALTER TABLE public.confirmacoes_adiantamento
  ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID NULL REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_pagamento DATE NULL,
  ADD COLUMN IF NOT EXISTS lote_pagamento_id UUID NULL REFERENCES public.lotes_pagamento(id) ON DELETE SET NULL;

ALTER TABLE public.fechamentos_financeiros
  ADD COLUMN IF NOT EXISTS conta_bancaria_id UUID NULL REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lote_pagamento_id UUID NULL REFERENCES public.lotes_pagamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_confirmacoes_adiantamento_conta_bancaria_id
  ON public.confirmacoes_adiantamento(conta_bancaria_id);

CREATE INDEX IF NOT EXISTS idx_fechamentos_financeiros_conta_bancaria_id
  ON public.fechamentos_financeiros(conta_bancaria_id);
