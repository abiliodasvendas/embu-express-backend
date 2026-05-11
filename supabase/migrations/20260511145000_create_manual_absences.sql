CREATE TABLE IF NOT EXISTS public.ausencias_manuais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    data_referencia DATE NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, data_referencia)
);

-- Comentário para o desenvolvedor: Tabela criada para persistir ausências marcadas manualmente pelo administrativo.
-- Resolve o problema de perda de dados ao reiniciar o servidor ou atualizar a página.
