-- Migration: Add missing columns to registros_ponto
-- Date: 2026-02-10

-- 1. Add columns to registros_ponto
ALTER TABLE public.registros_ponto
    ADD COLUMN IF NOT EXISTS cliente_id bigint,
    ADD COLUMN IF NOT EXISTS empresa_id bigint,
    ADD COLUMN IF NOT EXISTS entrada_loc jsonb,
    ADD COLUMN IF NOT EXISTS saida_loc jsonb;

-- 2. Add Foreign Key Constraints
ALTER TABLE public.registros_ponto
    DROP CONSTRAINT IF EXISTS fk_ponto_cliente,
    ADD CONSTRAINT fk_ponto_cliente FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_ponto_empresa,
    ADD CONSTRAINT fk_ponto_empresa FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE SET NULL;

-- 3. Add Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_registros_ponto_cliente ON public.registros_ponto(cliente_id);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_empresa ON public.registros_ponto(empresa_id);

-- 4. Comments for documentation
COMMENT ON COLUMN public.registros_ponto.cliente_id IS 'Cliente (Turno) vinculado a este registro de ponto';
COMMENT ON COLUMN public.registros_ponto.empresa_id IS 'Empresa pagadora vinculada a este registro de ponto';
COMMENT ON COLUMN public.registros_ponto.entrada_loc IS 'Dados de geolocalização capturados no momento da entrada';
COMMENT ON COLUMN public.registros_ponto.saida_loc IS 'Dados de geolocalização capturados no momento da saída';
