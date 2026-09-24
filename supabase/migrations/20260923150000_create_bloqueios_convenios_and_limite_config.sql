-- Tabela de Bloqueios de Convênio (Manual: Geral ou por Loja)
CREATE TABLE IF NOT EXISTS public.bloqueios_convenios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    convenio_id UUID NULL REFERENCES public.convenios(id) ON DELETE CASCADE,
    motivo TEXT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    criado_por UUID NULL REFERENCES public.usuarios(id)
);

ALTER TABLE public.bloqueios_convenios OWNER TO postgres;

-- Índices Únicos Parciais
-- 1. Garante unicidade do bloqueio geral por colaborador
CREATE UNIQUE INDEX IF NOT EXISTS uq_bloqueio_convenio_geral 
ON public.bloqueios_convenios (colaborador_id) 
WHERE convenio_id IS NULL;

-- 2. Garante unicidade do bloqueio específico por colaborador e convênio
CREATE UNIQUE INDEX IF NOT EXISTS uq_bloqueio_convenio_especifico 
ON public.bloqueios_convenios (colaborador_id, convenio_id) 
WHERE convenio_id IS NOT NULL;

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_bloqueios_convenios_colaborador 
ON public.bloqueios_convenios (colaborador_id);

CREATE INDEX IF NOT EXISTS idx_bloqueios_convenios_convenio 
ON public.bloqueios_convenios (convenio_id);

-- Permissões na tabela
GRANT ALL ON TABLE public.bloqueios_convenios TO anon, authenticated, service_role;

-- Inserção do parâmetro padrão de percentual limite na tabela de configurações
INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES (
    'percentual_limite_convenio',
    '30',
    'Percentual máximo dos rendimentos do colaborador permitido para convênios no mês'
)
ON CONFLICT (chave) DO NOTHING;
