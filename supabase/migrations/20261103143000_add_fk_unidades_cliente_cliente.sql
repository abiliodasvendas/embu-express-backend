-- Migration para adicionar Foreign Key de cliente em unidades_cliente
-- Permite queries relacionais PostgREST e garante integridade referencial

DELETE FROM public.unidades_cliente 
WHERE cliente_id NOT IN (SELECT id FROM public.clientes);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_unidades_cliente_cliente'
    ) THEN
        ALTER TABLE public.unidades_cliente
        ADD CONSTRAINT fk_unidades_cliente_cliente
        FOREIGN KEY (cliente_id)
        REFERENCES public.clientes(id)
        ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_unidades_cliente_cliente_id ON public.unidades_cliente(cliente_id);
