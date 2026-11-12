WITH conta_omie_padrao AS (
  SELECT id AS conta_omie_id
  FROM public.contas_bancarias
  WHERE empresa_id = 1 AND banco_nome ILIKE '%OMIE%'
  LIMIT 1
),
turnos_colab AS (
  SELECT DISTINCT ON (cc.colaborador_id)
    cc.colaborador_id,
    cc.empresa_id,
    cb.id AS conta_omie_id
  FROM public.colaborador_clientes cc
  JOIN public.contas_bancarias cb
    ON cb.empresa_id = cc.empresa_id
   AND cb.banco_nome ILIKE '%OMIE%'
  WHERE (cc.data_inicio IS NULL OR cc.data_inicio <= '2026-10-31')
    AND (cc.data_fim IS NULL OR cc.data_fim >= '2026-10-01')
  ORDER BY
    cc.colaborador_id,
    CASE WHEN cc.data_fim IS NULL THEN 0 ELSE 1 END,
    cc.valor_contrato DESC NULLS LAST,
    cc.id DESC
),
turnos_fallback AS (
  SELECT DISTINCT ON (cc.colaborador_id)
    cc.colaborador_id,
    cc.empresa_id,
    cb.id AS conta_omie_id
  FROM public.colaborador_clientes cc
  JOIN public.contas_bancarias cb
    ON cb.empresa_id = cc.empresa_id
   AND cb.banco_nome ILIKE '%OMIE%'
  ORDER BY
    cc.colaborador_id,
    CASE WHEN cc.data_fim IS NULL THEN 0 ELSE 1 END,
    cc.valor_contrato DESC NULLS LAST,
    cc.id DESC
),
resolved_contas AS (
  SELECT
    ff.id AS fechamento_id,
    COALESCE(
      tc.conta_omie_id,
      tf.conta_omie_id,
      (SELECT conta_omie_id FROM conta_omie_padrao)
    ) AS conta_omie_id
  FROM public.fechamentos_financeiros ff
  LEFT JOIN turnos_colab tc ON tc.colaborador_id = ff.colaborador_id
  LEFT JOIN turnos_fallback tf ON tf.colaborador_id = ff.colaborador_id
  WHERE ff.mes = 10
    AND ff.ano = 2026
    AND ff.pago = true
    AND ff.conta_bancaria_id IS NULL
)
UPDATE public.fechamentos_financeiros ff
SET conta_bancaria_id = rc.conta_omie_id
FROM resolved_contas rc
WHERE ff.id = rc.fechamento_id;
