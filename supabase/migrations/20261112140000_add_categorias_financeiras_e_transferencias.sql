-- Migration: Criação de Categorias Financeiras Dinâmicas e Suporte a Transferências entre Contas Bancárias

CREATE TABLE IF NOT EXISTS public.categorias_financeiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo varchar(80) NOT NULL UNIQUE,
  nome varchar(120) NOT NULL,
  escopo varchar(30) NOT NULL CHECK (escopo IN ('ENTRADA_AVULSA', 'SAIDA_AVULSA', 'DESPESA')),
  grupo_dre varchar(50) NOT NULL CHECK (
    grupo_dre IN (
      'RECEITA_OPERACIONAL',
      'DESPESA_FIXA',
      'TRIBUTO_DAS',
      'PROLABORE',
      'PARCELAMENTO_FISCAL',
      'INVESTIMENTO_FINANCIAMENTO',
      'DESPESA_FINANCEIRA',
      'NAO_AFETA_DRE'
    )
  ),
  afeta_dre boolean NOT NULL DEFAULT true,
  is_sistema boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categorias_financeiras_escopo_ativo
  ON public.categorias_financeiras (escopo, ativo);

ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de categorias_financeiras para autenticados" ON public.categorias_financeiras;
CREATE POLICY "Permitir leitura de categorias_financeiras para autenticados"
  ON public.categorias_financeiras
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Permitir escrita de categorias_financeiras para service_role" ON public.categorias_financeiras;
CREATE POLICY "Permitir escrita de categorias_financeiras para service_role"
  ON public.categorias_financeiras
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO public.categorias_financeiras (codigo, nome, escopo, grupo_dre, afeta_dre, is_sistema, ativo)
VALUES
  -- Entradas Avulsas
  ('FRETE_ESPORADICO', 'Frete Esporádico / À Vista', 'ENTRADA_AVULSA', 'RECEITA_OPERACIONAL', true, true, true),
  ('RENDIMENTO_APLICACAO', 'Rendimento de Aplicação Bancária', 'ENTRADA_AVULSA', 'RECEITA_OPERACIONAL', true, true, true),
  ('REEMBOLSO_CLIENTE', 'Reembolso / Estorno Recebido', 'ENTRADA_AVULSA', 'RECEITA_OPERACIONAL', true, true, true),
  ('DOACAO_APORTE', 'Aporte / Empréstimo / Outros Créditos', 'ENTRADA_AVULSA', 'NAO_AFETA_DRE', false, true, true),
  ('OUTRAS_ENTRADAS', 'Outras Entradas Avulsas', 'ENTRADA_AVULSA', 'RECEITA_OPERACIONAL', true, true, true),

  -- Saídas Avulsas
  ('DESPESA_OPERACIONAL_AVULSA', 'Despesa Operacional / Emergencial', 'SAIDA_AVULSA', 'DESPESA_FIXA', true, true, true),
  ('REEMBOLSO_DESPESA', 'Reembolso de Despesa / Combustível / Pedágio', 'SAIDA_AVULSA', 'DESPESA_FIXA', true, true, true),
  ('TARIFA_BANCARIA', 'Tarifa / Taxa Bancária / IOF', 'SAIDA_AVULSA', 'DESPESA_FINANCEIRA', true, true, true),
  ('OUTRAS_SAIDAS', 'Outras Saídas Avulsas', 'SAIDA_AVULSA', 'DESPESA_FIXA', true, true, true),
  ('TRANSFERENCIA_ENTRE_CONTAS', 'Transferência entre Contas', 'SAIDA_AVULSA', 'NAO_AFETA_DRE', false, true, true),

  -- Contas a Pagar / Despesas Operacionais
  ('DESPESA_FIXA', 'Despesa Fixa (Aluguel, Contabilidade, Sistemas, Seguros)', 'DESPESA', 'DESPESA_FIXA', true, true, true),
  ('DESPESA_ADMINISTRATIVA', 'Despesa Administrativa / Escritório / Contas', 'DESPESA', 'DESPESA_FIXA', true, true, true),
  ('CARTAO_CREDITO', 'Cartão de Crédito Corporativo', 'DESPESA', 'DESPESA_FIXA', true, true, true),
  ('DESPESA_FROTA_DOCUMENTO', 'Frota / Documentação / Licenciamento / Multas', 'DESPESA', 'DESPESA_FIXA', true, true, true),
  ('TRIBUTO_DAS', 'Tributos / Simples Nacional (DAS)', 'DESPESA', 'TRIBUTO_DAS', true, true, true),
  ('PROLABORE', 'Pró-Labore / Retirada de Sócios', 'DESPESA', 'PROLABORE', true, true, true),
  ('PARCELAMENTO_FISCAL', 'Parcelamento Fiscal (Acordos / PGFN / Receita)', 'DESPESA', 'PARCELAMENTO_FISCAL', true, true, true),
  ('INVESTIMENTO_FINANCIAMENTO', 'Investimento / Financiamento Bancário / Consórcio', 'DESPESA', 'INVESTIMENTO_FINANCIAMENTO', true, true, true),
  ('INVESTIMENTO_PATRIMONIAL', 'Investimento Patrimonial (Imóveis, Obras, Aquisições)', 'DESPESA', 'INVESTIMENTO_FINANCIAMENTO', true, true, true),
  ('DESPESA_FINANCEIRA', 'Despesa Financeira (Tarifas, Juros, IOF)', 'DESPESA', 'DESPESA_FINANCEIRA', true, true, true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  escopo = EXCLUDED.escopo,
  grupo_dre = EXCLUDED.grupo_dre,
  afeta_dre = EXCLUDED.afeta_dre,
  is_sistema = EXCLUDED.is_sistema;

-- Colunas de vínculo para Transferência entre Contas em movimentacoes_avulsas
ALTER TABLE public.movimentacoes_avulsas
  ADD COLUMN IF NOT EXISTS transferencia_par_id uuid NULL,
  ADD COLUMN IF NOT EXISTS conta_contrapartida_id uuid NULL REFERENCES public.contas_bancarias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimentacoes_avulsas_transferencia_par
  ON public.movimentacoes_avulsas (transferencia_par_id)
  WHERE transferencia_par_id IS NOT NULL;

-- Substituição das constraints estáticas por validação flexível de não-vazio
ALTER TABLE public.movimentacoes_avulsas
  DROP CONSTRAINT IF EXISTS movimentacoes_avulsas_categoria_check;

ALTER TABLE public.movimentacoes_avulsas
  ADD CONSTRAINT movimentacoes_avulsas_categoria_check
  CHECK (char_length(trim(categoria)) > 0);

ALTER TABLE public.despesas_operacionais
  DROP CONSTRAINT IF EXISTS despesas_operacionais_categoria_check;

ALTER TABLE public.despesas_operacionais
  ADD CONSTRAINT despesas_operacionais_categoria_check
  CHECK (char_length(trim(categoria)) > 0);
