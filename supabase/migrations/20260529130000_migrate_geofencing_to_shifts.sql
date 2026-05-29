-- Adiciona a coluna validar_localizacao na tabela colaborador_clientes
ALTER TABLE colaborador_clientes 
ADD COLUMN IF NOT EXISTS validar_localizacao boolean NOT NULL DEFAULT true;

-- Remove a coluna validar_localizacao da tabela usuarios
ALTER TABLE usuarios 
DROP COLUMN IF EXISTS validar_localizacao;
