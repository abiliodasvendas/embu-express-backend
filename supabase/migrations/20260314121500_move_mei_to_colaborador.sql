-- Move valor_mei from colaborador_clientes to usuarios table
ALTER TABLE "public"."usuarios" ADD COLUMN "valor_mei" numeric DEFAULT 0;

-- Migrate existing data
UPDATE "public"."usuarios" u
SET "valor_mei" = (
    SELECT MAX(vc.valor_mei)
    FROM "public"."colaborador_clientes" vc
    WHERE vc.colaborador_id = u.id
)
WHERE EXISTS (
    SELECT 1 
    FROM "public"."colaborador_clientes" vc 
    WHERE vc.colaborador_id = u.id AND vc.valor_mei > 0
);

-- Remove from original table
ALTER TABLE "public"."colaborador_clientes" DROP COLUMN "valor_mei";
