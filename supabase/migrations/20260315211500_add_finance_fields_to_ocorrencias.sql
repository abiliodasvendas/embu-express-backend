-- Migration: Add finance fields to tipos_ocorrencia and ocorrencias
-- Description: Adds impacto_financeiro, valor_padrao and tipo_lancamento to track financial impact of occurrences.

-- 1. Ajustes na tabela de tipos de ocorrência
ALTER TABLE "public"."tipos_ocorrencia" 
ADD COLUMN IF NOT EXISTS "impacto_financeiro" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "valor_padrao" numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS "tipo_lancamento" character varying(10) DEFAULT 'SAIDA';

-- Adiciona a restrição (check) para o tipo de lançamento
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tipos_ocorrencia_tipo_lancamento_check') THEN
        ALTER TABLE "public"."tipos_ocorrencia" 
        ADD CONSTRAINT "tipos_ocorrencia_tipo_lancamento_check" 
        CHECK ("tipo_lancamento" = ANY (ARRAY['ENTRADA'::text, 'SAIDA'::text]));
    END IF;
END $$;

-- 2. Ajustes na tabela de ocorrências
ALTER TABLE "public"."ocorrencias" 
ADD COLUMN IF NOT EXISTS "impacto_financeiro" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "tipo_lancamento" character varying(10) DEFAULT 'SAIDA';

-- Adiciona a restrição (check) para o tipo de lançamento na tabela de ocorrências
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ocorrencias_tipo_lancamento_check') THEN
        ALTER TABLE "public"."ocorrencias" 
        ADD CONSTRAINT "ocorrencias_tipo_lancamento_check" 
        CHECK ("tipo_lancamento" = ANY (ARRAY['ENTRADA'::text, 'SAIDA'::text]));
    END IF;
END $$;
