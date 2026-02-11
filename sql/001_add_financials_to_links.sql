-- Add financial columns to colaborador_clientes table
ALTER TABLE colaborador_clientes ADD COLUMN IF NOT EXISTS valor_contrato DECIMAL(10,2);
ALTER TABLE colaborador_clientes ADD COLUMN IF NOT EXISTS valor_aluguel DECIMAL(10,2);
ALTER TABLE colaborador_clientes ADD COLUMN IF NOT EXISTS valor_bonus DECIMAL(10,2);
ALTER TABLE colaborador_clientes ADD COLUMN IF NOT EXISTS ajuda_custo DECIMAL(10,2);
ALTER TABLE colaborador_clientes ADD COLUMN IF NOT EXISTS mei BOOLEAN DEFAULT FALSE;
