-- Add 'codigo' to empresas (unique identifier like 'EE', 'ES')
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS codigo text;

-- Create unique index for codigo to ensure uniqueness (if needed later)
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_codigo ON public.empresas(codigo);


-- Add Extended Profile Columns to usuarios
ALTER TABLE public.usuarios
    -- Personal Data
    ADD COLUMN IF NOT EXISTS data_nascimento DATE,
    ADD COLUMN IF NOT EXISTS rg TEXT,
    ADD COLUMN IF NOT EXISTS nome_mae TEXT,
    ADD COLUMN IF NOT EXISTS endereco_completo TEXT,
    ADD COLUMN IF NOT EXISTS telefone TEXT,
    ADD COLUMN IF NOT EXISTS telefone_recado TEXT,
    ADD COLUMN IF NOT EXISTS data_inicio DATE,

    -- Moto / Professional Data
    ADD COLUMN IF NOT EXISTS cnh_registro TEXT,
    ADD COLUMN IF NOT EXISTS cnh_vencimento DATE,
    ADD COLUMN IF NOT EXISTS cnh_categoria TEXT,
    ADD COLUMN IF NOT EXISTS cnpj TEXT,
    ADD COLUMN IF NOT EXISTS chave_pix TEXT,
    ADD COLUMN IF NOT EXISTS moto_modelo TEXT,
    ADD COLUMN IF NOT EXISTS moto_cor TEXT,
    ADD COLUMN IF NOT EXISTS moto_ano TEXT,
    ADD COLUMN IF NOT EXISTS moto_placa TEXT,

    -- Financial / Contract Data
    ADD COLUMN IF NOT EXISTS nome_operacao TEXT,
    ADD COLUMN IF NOT EXISTS empresa_financeiro_id BIGINT REFERENCES public.empresas(id),
    ADD COLUMN IF NOT EXISTS valor_contrato DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valor_aluguel DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valor_ajuda_custo DECIMAL(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS valor_bonus DECIMAL(10,2) DEFAULT 0, -- Zero Falta
    ADD COLUMN IF NOT EXISTS valor_mei DECIMAL(10,2) DEFAULT 0;

-- Comments for documentation
COMMENT ON COLUMN public.empresas.codigo IS 'Sigla da empresa (ex: EE, ES, ED)';
COMMENT ON COLUMN public.usuarios.valor_bonus IS 'Valor referente ao bônus Zero Falta';
