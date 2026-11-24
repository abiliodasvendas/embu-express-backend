INSERT INTO public.categorias_financeiras (codigo, nome, escopo, grupo_dre, afeta_dre, is_sistema, ativo)
VALUES (
  'EMPRESTIMO',
  'Empréstimos (Parcelas / Amortização)',
  'DESPESA',
  'INVESTIMENTO_FINANCIAMENTO',
  true,
  true,
  true
)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  escopo = EXCLUDED.escopo,
  grupo_dre = EXCLUDED.grupo_dre,
  afeta_dre = EXCLUDED.afeta_dre,
  is_sistema = EXCLUDED.is_sistema,
  ativo = true;
