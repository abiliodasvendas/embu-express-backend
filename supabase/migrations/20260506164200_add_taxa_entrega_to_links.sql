-- Adiciona o campo taxa_entrega à tabela de vínculos
ALTER TABLE colaborador_clientes ADD COLUMN taxa_entrega NUMERIC(10,2) DEFAULT 0;
