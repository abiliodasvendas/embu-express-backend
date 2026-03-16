-- Adiciona a coluna de tolerância de pausa (em minutos) nos vínculos dos colaboradores
ALTER TABLE "public"."colaborador_clientes" 
ADD COLUMN "tolerancia_pausa_min" integer DEFAULT 0 NOT NULL;

COMMENT ON COLUMN "public"."colaborador_clientes"."tolerancia_pausa_min" IS 'Tempo de pausa (em minutos) que o colaborador tem direito antes de começar a descontar do total trabalhado.';
