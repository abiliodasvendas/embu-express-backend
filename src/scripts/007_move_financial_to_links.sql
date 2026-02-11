-- Add financial columns to collaborator_clientes table
ALTER TABLE public.colaborador_clientes ADD COLUMN IF NOT EXISTS valor_contrato numeric DEFAULT 0;
ALTER TABLE public.colaborador_clientes ADD COLUMN IF NOT EXISTS valor_aluguel numeric DEFAULT 0;
ALTER TABLE public.colaborador_clientes ADD COLUMN IF NOT EXISTS valor_bonus numeric DEFAULT 0;
ALTER TABLE public.colaborador_clientes ADD COLUMN IF NOT EXISTS ajuda_custo numeric DEFAULT 0;
ALTER TABLE public.colaborador_clientes ADD COLUMN IF NOT EXISTS mei boolean DEFAULT false;

-- Add comments
COMMENT ON COLUMN public.colaborador_clientes.valor_contrato IS 'Valor do contrato para este vínculo específico';
COMMENT ON COLUMN public.colaborador_clientes.valor_aluguel IS 'Valor do aluguel da moto para este vínculo';
COMMENT ON COLUMN public.colaborador_clientes.valor_bonus IS 'Valor de bônus (Zero Falta) para este vínculo';
COMMENT ON COLUMN public.colaborador_clientes.ajuda_custo IS 'Ajuda de custo para este vínculo';
COMMENT ON COLUMN public.colaborador_clientes.mei IS 'Se é contrato MEI neste vínculo';

-- Optional: Drop columns from usuarios if you are sure they are not needed anymore
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS valor_contrato;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS valor_aluguel;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS valor_bonus;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS ajuda_custo;
ALTER TABLE public.usuarios DROP COLUMN IF EXISTS valor_mei;
