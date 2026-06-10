-- Tabela de Convênios (Lojas)
CREATE TABLE IF NOT EXISTS public.convenios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    ativo BOOLEAN DEFAULT true,
    token VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.convenios OWNER TO postgres;

-- Tabela de Lançamentos de Convênio
CREATE TABLE IF NOT EXISTS public.lancamentos_convenios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    convenio_id UUID REFERENCES public.convenios(id) ON DELETE CASCADE,
    colaborador_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
    valor NUMERIC(10,2) NOT NULL,
    descricao TEXT,
    moto_embu BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.lancamentos_convenios OWNER TO postgres;

-- GRANTS
GRANT ALL ON TABLE public.convenios TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.lancamentos_convenios TO anon, authenticated, service_role;

-- 1. Inserir as novas permissões dedicadas de Convênios
INSERT INTO public.permissoes (nome_interno, modulo, descricao) VALUES
('convenios:ver', 'Convênios', 'Permite visualizar a lista de convênios cadastrados'),
('convenios:editar', 'Convênios', 'Permite criar, editar e excluir convênios')
ON CONFLICT (nome_interno) DO UPDATE SET
    modulo = EXCLUDED.modulo,
    descricao = EXCLUDED.descricao;

-- 2. Vincular as novas permissões ao perfil 'super_admin'
INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, perm.id
FROM public.perfis p
CROSS JOIN public.permissoes perm
WHERE p.nome = 'super_admin' AND perm.nome_interno IN ('convenios:ver', 'convenios:editar')
ON CONFLICT DO NOTHING;


-- Sincronizar sequences para evitar conflitos de ID
SELECT setval('public.permissoes_id_seq', (SELECT MAX(id) FROM public.permissoes));
