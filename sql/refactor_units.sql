-- 1. Tabela de Unidades (Novo)
CREATE TABLE unidades_cliente (
    id BIGSERIAL PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    nome_unidade TEXT NOT NULL,
    razao_social TEXT NOT NULL,
    cnpj TEXT NOT NULL UNIQUE,
    cep TEXT NOT NULL,
    logradouro TEXT NOT NULL,
    numero TEXT NOT NULL,
    complemento TEXT,
    bairro TEXT NOT NULL,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL,
    km_contratados INTEGER DEFAULT 0,
    escala_semanal INTEGER[] DEFAULT '{}',
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Simplificação da Tabela Clientes
-- Removendo campos que agora pertencem à Unidade
ALTER TABLE clientes 
DROP COLUMN IF EXISTS cnpj,
DROP COLUMN IF EXISTS razao_social,
DROP COLUMN IF EXISTS logradouro,
DROP COLUMN IF EXISTS numero,
DROP COLUMN IF EXISTS complemento,
DROP COLUMN IF EXISTS bairro,
DROP COLUMN IF EXISTS cidade,
DROP COLUMN IF EXISTS estado,
DROP COLUMN IF EXISTS cep,
DROP COLUMN IF EXISTS logo_url,
DROP COLUMN IF EXISTS km_contratados,
DROP COLUMN IF EXISTS escala_semanal;

-- 3. Atualização da Tabela de Vínculos (Colaborador x Unidade)
ALTER TABLE colaborador_clientes
ADD COLUMN unidade_id BIGINT REFERENCES unidades_cliente(id) ON DELETE SET NULL;

-- 4. Índice para performance
CREATE INDEX idx_unidades_cliente_id ON unidades_cliente(cliente_id);
CREATE INDEX idx_colaborador_clientes_unidade_id ON colaborador_clientes(unidade_id);
