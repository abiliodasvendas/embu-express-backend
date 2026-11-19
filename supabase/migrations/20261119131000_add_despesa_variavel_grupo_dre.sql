DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'categorias_financeiras'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%grupo_dre%'
  LOOP
    EXECUTE format('ALTER TABLE public.categorias_financeiras DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.categorias_financeiras
  ADD CONSTRAINT categorias_financeiras_grupo_dre_check CHECK (
    grupo_dre IN (
      'RECEITA_OPERACIONAL',
      'DESPESA_FIXA',
      'DESPESA_VARIAVEL',
      'TRIBUTO_DAS',
      'PROLABORE',
      'PARCELAMENTO_FISCAL',
      'INVESTIMENTO_FINANCIAMENTO',
      'DESPESA_FINANCEIRA',
      'NAO_AFETA_DRE'
    )
  );
