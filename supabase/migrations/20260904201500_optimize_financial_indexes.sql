CREATE INDEX IF NOT EXISTS idx_fechamentos_competencia ON public.fechamentos_financeiros (ano, mes, pago);
CREATE INDEX IF NOT EXISTS idx_fechamentos_colab_comp ON public.fechamentos_financeiros (colaborador_id, ano, mes);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_competencia ON public.confirmacoes_adiantamento (ano, mes);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_colab_comp ON public.confirmacoes_adiantamento (colaborador_id, ano, mes);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_colab_data ON public.ocorrencias (colaborador_id, data_ocorrencia);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_data_impacto ON public.ocorrencias (data_ocorrencia, impacto_financeiro);

CREATE INDEX IF NOT EXISTS idx_usuarios_status ON public.usuarios (status);
