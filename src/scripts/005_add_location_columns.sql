-- Add location and link columns to registros_ponto
ALTER TABLE "registros_ponto" 
ADD COLUMN IF NOT EXISTS "entrada_loc" JSONB,
ADD COLUMN IF NOT EXISTS "saida_loc" JSONB,
ADD COLUMN IF NOT EXISTS "cliente_id" BIGINT REFERENCES "clientes"("id"),
ADD COLUMN IF NOT EXISTS "empresa_id" BIGINT REFERENCES "empresas"("id");

-- Add location columns to registros_pausas
ALTER TABLE "registros_pausas" 
ADD COLUMN IF NOT EXISTS "inicio_loc" JSONB,
ADD COLUMN IF NOT EXISTS "fim_loc" JSONB;
