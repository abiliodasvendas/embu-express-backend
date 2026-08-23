ALTER TABLE "public"."confirmacoes_adiantamento"
ADD COLUMN IF NOT EXISTS "valor" numeric(10, 2) DEFAULT NULL;

COMMENT ON COLUMN "public"."confirmacoes_adiantamento"."valor" IS 'Valor customizado do adiantamento pago no período. Se NULL, assume o valor configurado nos turnos ativos.';
