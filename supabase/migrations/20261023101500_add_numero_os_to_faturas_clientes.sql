ALTER TABLE faturas_clientes ADD COLUMN IF NOT EXISTS numero_os TEXT;

CREATE INDEX IF NOT EXISTS idx_faturas_clientes_numero_os ON faturas_clientes(numero_os);
