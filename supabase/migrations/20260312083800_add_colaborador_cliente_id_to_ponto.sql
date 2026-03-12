-- Migration: Add colaborador_cliente_id to registros_ponto
-- Created at: 2026-03-12 08:38:00
-- Description: Adds a specific link ID to point records to correctly handle multiple shifts.

-- 1. Adicionar coluna para vínculo específico
ALTER TABLE "public"."registros_ponto" ADD COLUMN IF NOT EXISTS "colaborador_cliente_id" bigint;

-- 2. Adicionar constraint de chave estrangeira
-- Nota: Usamos IF NOT EXISTS ou drop/create para garantir idempotência se necessário, 
-- mas em migrations padrão Supabase o arquivo roda uma única vez.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_ponto_vinculo') THEN
        ALTER TABLE ONLY "public"."registros_ponto"
            ADD CONSTRAINT "fk_ponto_vinculo" FOREIGN KEY ("colaborador_cliente_id") REFERENCES "public"."colaborador_clientes"("id") ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Adicionar índice para performance
CREATE INDEX IF NOT EXISTS "idx_registros_ponto_vinculo" ON "public"."registros_ponto" USING "btree" ("colaborador_cliente_id");

-- 4. Comentário explicativo
COMMENT ON COLUMN "public"."registros_ponto"."colaborador_cliente_id" IS 'ID do vínculo (turno) específico do colaborador para este registro';
