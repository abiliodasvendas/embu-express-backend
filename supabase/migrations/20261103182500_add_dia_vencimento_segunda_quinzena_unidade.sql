-- Adiciona coluna de dia de vencimento da 2a quinzena para unidades com periodicidade quinzenal
ALTER TABLE public.unidades_cliente
ADD COLUMN IF NOT EXISTS dia_vencimento_segunda_quinzena INTEGER;

COMMENT ON COLUMN public.unidades_cliente.dia_vencimento_segunda_quinzena IS 'Dia de vencimento da segunda quinzena para faturamento quinzenal (ex: 30 ou ultimo dia)';
