UPDATE public.colaborador_clientes cc
SET data_fim = GREATEST(
  COALESCE(cc.data_inicio, '2025-01-01'::date),
  COALESCE(
    (
      SELECT MAX(rp.data_referencia)::date
      FROM public.registros_ponto rp
      WHERE rp.usuario_id = cc.colaborador_id
    ),
    u.updated_at::date,
    CURRENT_DATE
  )
)
FROM public.usuarios u
WHERE cc.colaborador_id = u.id
  AND u.status = 'INATIVO'
  AND cc.data_fim IS NULL;

CREATE OR REPLACE FUNCTION public.fn_encerrar_vinculos_usuario_inativo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'INATIVO' AND (OLD.status IS DISTINCT FROM 'INATIVO') THEN
    UPDATE public.colaborador_clientes
    SET data_fim = GREATEST(
      COALESCE(data_inicio, CURRENT_DATE),
      CURRENT_DATE
    )
    WHERE colaborador_id = NEW.id
      AND data_fim IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_encerrar_vinculos_usuario_inativo ON public.usuarios;

CREATE TRIGGER trg_encerrar_vinculos_usuario_inativo
AFTER UPDATE OF status ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION public.fn_encerrar_vinculos_usuario_inativo();
