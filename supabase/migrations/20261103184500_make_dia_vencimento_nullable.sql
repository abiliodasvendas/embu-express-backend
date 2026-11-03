-- Permite que dia_vencimento_padrao seja nulo para periodicidades quinzenal e semanal
ALTER TABLE public.convenios
ALTER COLUMN dia_vencimento_padrao DROP NOT NULL;

ALTER TABLE public.unidades_cliente
ALTER COLUMN dia_vencimento_padrao DROP NOT NULL;
