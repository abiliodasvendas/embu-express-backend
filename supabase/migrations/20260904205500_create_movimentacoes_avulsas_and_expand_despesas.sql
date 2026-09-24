-- --- MOVIMENTACOES AVULSAS & REFINAMENTO DE CATEGORIAS DE DESPESAS ---
-- Migration Timestamp: 20260904205500

-- 1. Criar Tabela de Movimentações Avulsas da Empresa (Entradas e Saídas Diversas)
CREATE TABLE IF NOT EXISTS public.movimentacoes_avulsas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
    conta_bancaria_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
    tipo_movimentacao VARCHAR(20) NOT NULL CHECK (tipo_movimentacao IN ('ENTRADA', 'SAIDA')),
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('CLIENTE_A_VISTA', 'RENDIMENTO_APLICACAO', 'REEMBOLSO', 'OUTRAS_RECEITAS', 'OUTRAS_DESPESAS')),
    descricao TEXT NOT NULL,
    valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    data_movimentacao DATE NOT NULL DEFAULT CURRENT_DATE,
    mes_competencia INTEGER NOT NULL CHECK (mes_competencia >= 1 AND mes_competencia <= 12),
    ano_competencia INTEGER NOT NULL,
    comprovante_url TEXT,
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.movimentacoes_avulsas OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_movimentacoes_avulsas_comp ON public.movimentacoes_avulsas (ano_competencia, mes_competencia);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_avulsas_data ON public.movimentacoes_avulsas (data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_avulsas_empresa ON public.movimentacoes_avulsas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_avulsas_conta ON public.movimentacoes_avulsas (conta_bancaria_id);

CREATE TRIGGER tr_movimentacoes_avulsas_updated_at BEFORE UPDATE ON public.movimentacoes_avulsas FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Expandir Constraint de Categorias na Tabela despesas_operacionais
ALTER TABLE public.despesas_operacionais DROP CONSTRAINT IF EXISTS despesas_operacionais_categoria_check;

ALTER TABLE public.despesas_operacionais ADD CONSTRAINT despesas_operacionais_categoria_check CHECK (
    categoria IN (
        'DESPESA_FIXA',
        'TRIBUTO_DAS',
        'PARCELAMENTO_FISCAL',
        'INVESTIMENTO_FINANCIAMENTO',
        'DESPESA_FINANCEIRA',
        'PROLABORE',
        'INVESTIMENTO_PATRIMONIAL',
        'CARTAO_CREDITO',
        'DESPESA_ADMINISTRATIVA',
        'DESPESA_FROTA_DOCUMENTO'
    )
);

-- 3. Permissões de Movimentações Avulsas
INSERT INTO public.permissoes (nome_interno, modulo, descricao) VALUES
('movimentacoes_avulsas:ver', 'Financeiro', 'Permite visualizar movimentações avulsas da empresa'),
('movimentacoes_avulsas:editar', 'Financeiro', 'Permite registrar, editar e excluir movimentações avulsas da empresa')
ON CONFLICT (nome_interno) DO UPDATE SET
    modulo = EXCLUDED.modulo,
    descricao = EXCLUDED.descricao;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, perm.id
FROM public.perfis p
CROSS JOIN public.permissoes perm
WHERE p.nome IN ('super_admin', 'ceo')
  AND perm.nome_interno IN ('movimentacoes_avulsas:ver', 'movimentacoes_avulsas:editar')
ON CONFLICT DO NOTHING;

-- Grants
GRANT ALL ON TABLE public.movimentacoes_avulsas TO anon, authenticated, service_role;

SELECT setval('public.permissoes_id_seq', (SELECT MAX(id) FROM public.permissoes));
