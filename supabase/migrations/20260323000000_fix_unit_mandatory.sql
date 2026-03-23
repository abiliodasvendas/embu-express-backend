-- Migration: Fix unit mandatory in colaborador_clientes
-- Date: 2026-03-23

-- Pre-checks are done in thought, count shows 0 NULLs.
ALTER TABLE "public"."colaborador_clientes" ALTER COLUMN "unidade_id" SET NOT NULL;

-- Ensure the foreign key exists and is correct (it's already correct in initial_schema but good to double check)
-- Actually, the constraint is named fk_colaborador_cliente_unidade.
