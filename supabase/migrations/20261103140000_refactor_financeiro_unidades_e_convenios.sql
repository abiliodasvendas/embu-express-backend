DELETE FROM public.fatura_recebimentos;
DELETE FROM public.faturas_clientes;

ALTER TABLE public.unidades_cliente
    ADD COLUMN IF NOT EXISTS valor_contrato_mensal NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS periodicidade VARCHAR(50) NOT NULL DEFAULT 'QUINZENAL',
    ADD COLUMN IF NOT EXISTS dia_vencimento_padrao INTEGER NOT NULL DEFAULT 16,
    ADD COLUMN IF NOT EXISTS empresa_emissora_padrao_id BIGINT REFERENCES public.empresas(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tipo_cobranca VARCHAR(50) NOT NULL DEFAULT 'FIXO_MENSAL';

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unidades_cliente_periodicidade_check') THEN
        ALTER TABLE public.unidades_cliente ADD CONSTRAINT unidades_cliente_periodicidade_check 
            CHECK (periodicidade IN ('QUINZENAL', 'MENSAL', 'SEMANAL'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unidades_cliente_dia_vencimento_padrao_check') THEN
        ALTER TABLE public.unidades_cliente ADD CONSTRAINT unidades_cliente_dia_vencimento_padrao_check 
            CHECK (dia_vencimento_padrao >= 1 AND dia_vencimento_padrao <= 31);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unidades_cliente_tipo_cobranca_check') THEN
        ALTER TABLE public.unidades_cliente ADD CONSTRAINT unidades_cliente_tipo_cobranca_check 
            CHECK (tipo_cobranca IN ('FIXO_MENSAL', 'DIARIA_MOTOBOY', 'PRODUCAO_ENTREGA'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_unidades_cliente_ativo ON public.unidades_cliente (cliente_id, ativo);

ALTER TABLE public.clientes
    DROP COLUMN IF EXISTS valor_contrato_mensal,
    DROP COLUMN IF EXISTS valor_base,
    DROP COLUMN IF EXISTS periodicidade,
    DROP COLUMN IF EXISTS dia_vencimento_padrao,
    DROP COLUMN IF EXISTS empresa_emissora_padrao_id,
    DROP COLUMN IF EXISTS tipo_cobranca;

ALTER TABLE public.faturas_clientes
    ADD COLUMN IF NOT EXISTS unidade_id BIGINT NOT NULL REFERENCES public.unidades_cliente(id) ON DELETE CASCADE;

DROP INDEX IF EXISTS public.idx_faturas_clientes_unicidade_periodo;

CREATE UNIQUE INDEX idx_faturas_clientes_unicidade_periodo 
ON public.faturas_clientes (unidade_id, mes_competencia, ano_competencia, tipo_periodo, numero_periodo);

CREATE INDEX IF NOT EXISTS idx_faturas_clientes_unidade ON public.faturas_clientes (unidade_id);

ALTER TABLE public.convenios
    ADD COLUMN IF NOT EXISTS dia_vencimento_padrao INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS periodicidade VARCHAR(50) NOT NULL DEFAULT 'MENSAL';

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'convenios_dia_vencimento_padrao_check') THEN
        ALTER TABLE public.convenios ADD CONSTRAINT convenios_dia_vencimento_padrao_check 
            CHECK (dia_vencimento_padrao >= 1 AND dia_vencimento_padrao <= 31);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'convenios_periodicidade_check') THEN
        ALTER TABLE public.convenios ADD CONSTRAINT convenios_periodicidade_check 
            CHECK (periodicidade IN ('MENSAL', 'QUINZENAL', 'SEMANAL'));
    END IF;
END $$;

ALTER TABLE public.faturas_fornecedores_convenios
    ADD COLUMN IF NOT EXISTS tipo_periodo VARCHAR(50) NOT NULL DEFAULT 'MENSAL',
    ADD COLUMN IF NOT EXISTS numero_periodo INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS quinzena INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS data_inicio_apuracao DATE,
    ADD COLUMN IF NOT EXISTS data_fim_apuracao DATE;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'faturas_fornecedores_convenios_tipo_periodo_check') THEN
        ALTER TABLE public.faturas_fornecedores_convenios ADD CONSTRAINT faturas_fornecedores_convenios_tipo_periodo_check 
            CHECK (tipo_periodo IN ('MENSAL', 'QUINZENAL', 'SEMANAL'));
    END IF;
END $$;

ALTER TABLE public.faturas_fornecedores_convenios 
    DROP CONSTRAINT IF EXISTS uq_fatura_convenio_competencia;

DROP INDEX IF EXISTS public.idx_faturas_convenio_comp;

CREATE UNIQUE INDEX IF NOT EXISTS idx_faturas_fornecedores_convenios_unicidade 
ON public.faturas_fornecedores_convenios (convenio_id, ano_competencia, mes_competencia, tipo_periodo, numero_periodo);

DELETE FROM public.configuracoes_sistema WHERE chave = 'dia_desembolso_convenios';
