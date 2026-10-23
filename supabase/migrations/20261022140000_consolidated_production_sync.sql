-- ==============================================================================
-- MIGRATION MESTRE: SINCRONIZAÇÃO COMPLETA DO MÓDULO FINANCEIRO EM PRODUÇÃO
-- Timestamp: 20261022140000
-- Descrição: Criação e sincronização idempotente de todas as tabelas financeiras,
--             contas a pagar, faturas, intercompany, convênios e permissões.
-- ==============================================================================

-- 0. Garantir função de updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. Contas Bancárias
CREATE TABLE IF NOT EXISTS public.contas_bancarias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    banco_nome VARCHAR(100) NOT NULL,
    agencia VARCHAR(20),
    conta VARCHAR(30),
    tipo_conta VARCHAR(20) DEFAULT 'CORRENTE',
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.contas_bancarias OWNER TO postgres;

DROP TRIGGER IF EXISTS tr_contas_bancarias_updated_at ON public.contas_bancarias;
CREATE TRIGGER tr_contas_bancarias_updated_at BEFORE UPDATE ON public.contas_bancarias FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Clientes: Configurações Contratuais e Financeiras
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_cobranca VARCHAR(50) DEFAULT 'DIARIA_MOTOBOY';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS valor_base NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS valor_diaria_glosa NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_emissora_padrao_id BIGINT REFERENCES public.empresas(id) ON DELETE SET NULL;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS periodicidade VARCHAR(50) DEFAULT 'QUINZENAL';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS dia_vencimento_padrao INTEGER DEFAULT 16;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS valor_contrato_mensal NUMERIC(12, 2) DEFAULT 0;

UPDATE public.clientes
SET valor_contrato_mensal = COALESCE(valor_base, 0)
WHERE valor_contrato_mensal IS NULL OR valor_contrato_mensal = 0;

UPDATE public.clientes
SET periodicidade = 'QUINZENAL'
WHERE periodicidade IS NULL OR periodicidade = 'SEMANAL';

ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_periodicidade_check;
ALTER TABLE public.clientes ADD CONSTRAINT clientes_periodicidade_check
    CHECK (periodicidade IN ('QUINZENAL', 'MENSAL'));

-- 3. Faturas dos Clientes
CREATE TABLE IF NOT EXISTS public.faturas_clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
    empresa_id BIGINT NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
    mes_competencia INTEGER NOT NULL CHECK (mes_competencia >= 1 AND mes_competencia <= 12),
    ano_competencia INTEGER NOT NULL,
    quinzena INTEGER,
    tipo_periodo VARCHAR(50) NOT NULL DEFAULT 'QUINZENAL',
    numero_periodo INTEGER NOT NULL DEFAULT 1,
    data_inicio_apuracao DATE,
    data_fim_apuracao DATE,
    valor_faturado NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_pago NUMERIC(10,2) NOT NULL DEFAULT 0,
    data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE',
    dias_esperados INTEGER DEFAULT 0,
    dias_trabalhados INTEGER DEFAULT 0,
    faltas_sem_cobertura INTEGER DEFAULT 0,
    valor_glosa NUMERIC(10,2) DEFAULT 0,
    observacoes TEXT,
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.faturas_clientes OWNER TO postgres;

-- Adicionar colunas se tabela já existia
ALTER TABLE public.faturas_clientes ADD COLUMN IF NOT EXISTS tipo_periodo VARCHAR(50) DEFAULT 'QUINZENAL';
ALTER TABLE public.faturas_clientes ADD COLUMN IF NOT EXISTS numero_periodo INTEGER DEFAULT 1;
ALTER TABLE public.faturas_clientes ADD COLUMN IF NOT EXISTS data_inicio_apuracao DATE;
ALTER TABLE public.faturas_clientes ADD COLUMN IF NOT EXISTS data_fim_apuracao DATE;

ALTER TABLE public.faturas_clientes DROP CONSTRAINT IF EXISTS faturas_clientes_quinzena_check;
ALTER TABLE public.faturas_clientes DROP CONSTRAINT IF EXISTS faturas_clientes_tipo_periodo_check;
ALTER TABLE public.faturas_clientes ADD CONSTRAINT faturas_clientes_tipo_periodo_check 
    CHECK (tipo_periodo IN ('QUINZENAL', 'MENSAL'));

ALTER TABLE public.faturas_clientes DROP CONSTRAINT IF EXISTS faturas_clientes_status_check;
ALTER TABLE public.faturas_clientes ADD CONSTRAINT faturas_clientes_status_check
    CHECK (status IN ('PENDENTE', 'PAGO_PARCIAL', 'LIQUIDADA', 'CANCELADA'));

CREATE INDEX IF NOT EXISTS idx_faturas_competencia ON public.faturas_clientes (ano_competencia, mes_competencia);
CREATE INDEX IF NOT EXISTS idx_faturas_empresa ON public.faturas_clientes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_faturas_cliente ON public.faturas_clientes (cliente_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_faturas_clientes_unicidade_periodo 
ON public.faturas_clientes (cliente_id, mes_competencia, ano_competencia, tipo_periodo, numero_periodo);

DROP TRIGGER IF EXISTS tr_faturas_clientes_updated_at ON public.faturas_clientes;
CREATE TRIGGER tr_faturas_clientes_updated_at BEFORE UPDATE ON public.faturas_clientes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Lotes de Recebimento
CREATE TABLE IF NOT EXISTS public.lotes_recebimento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conta_bancaria_destino_id UUID NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE RESTRICT,
    data_deposito DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_total_depositado NUMERIC(10,2) NOT NULL CHECK (valor_total_depositado > 0),
    observacao TEXT,
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.lotes_recebimento OWNER TO postgres;
ALTER TABLE public.lotes_recebimento DROP COLUMN IF EXISTS comprovante_url;

-- 5. Itens de Recebimento de Faturas (Distribuição do Lote)
CREATE TABLE IF NOT EXISTS public.fatura_recebimentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lote_recebimento_id UUID REFERENCES public.lotes_recebimento(id) ON DELETE SET NULL,
    fatura_id UUID NOT NULL REFERENCES public.faturas_clientes(id) ON DELETE CASCADE,
    conta_bancaria_id UUID NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE RESTRICT,
    data_recebimento DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_alocado NUMERIC(10,2) NOT NULL CHECK (valor_alocado > 0),
    observacao TEXT,
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.fatura_recebimentos OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_fatura_recebimentos_fatura ON public.fatura_recebimentos (fatura_id);
CREATE INDEX IF NOT EXISTS idx_fatura_recebimentos_lote ON public.fatura_recebimentos (lote_recebimento_id);

-- 6. Transferências Intercompany (Conta Corrente entre os CNPJs)
CREATE TABLE IF NOT EXISTS public.transferencias_intercompany (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fatura_recebimento_id UUID REFERENCES public.fatura_recebimentos(id) ON DELETE SET NULL,
    empresa_credora_id BIGINT NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
    empresa_devedora_id BIGINT NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
    valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    data_fato_gerador DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE_ACERTO' CHECK (status IN ('PENDENTE_ACERTO', 'COMPENSADO')),
    data_acerto DATE,
    comprovante_acerto_url TEXT,
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.transferencias_intercompany OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_intercompany_empresas ON public.transferencias_intercompany (empresa_credora_id, empresa_devedora_id, status);

DROP TRIGGER IF EXISTS tr_transferencias_intercompany_updated_at ON public.transferencias_intercompany;
CREATE TRIGGER tr_transferencias_intercompany_updated_at BEFORE UPDATE ON public.transferencias_intercompany FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. Despesas Operacionais (Contas a Pagar / DRE / Fluxo de Caixa)
CREATE TABLE IF NOT EXISTS public.despesas_operacionais (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id BIGINT REFERENCES public.empresas(id) ON DELETE RESTRICT,
    categoria VARCHAR(50) NOT NULL,
    descricao TEXT NOT NULL,
    mes_competencia INTEGER NOT NULL CHECK (mes_competencia >= 1 AND mes_competencia <= 12),
    ano_competencia INTEGER NOT NULL,
    valor_previsto NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_pago NUMERIC(10,2) DEFAULT 0,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ADIADA', 'PAGO', 'CANCELADO')),
    is_holding BOOLEAN NOT NULL DEFAULT false,
    grupo_parcelamento_id UUID,
    numero_parcela INTEGER,
    total_parcelas INTEGER,
    is_recorrente BOOLEAN DEFAULT false,
    recorrencia_origem_id UUID REFERENCES public.despesas_operacionais(id) ON DELETE CASCADE,
    dia_vencimento_base INTEGER,
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.despesas_operacionais OWNER TO postgres;

-- Adicionar colunas se tabela já existia
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS grupo_parcelamento_id UUID;
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS numero_parcela INTEGER;
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS total_parcelas INTEGER;
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS is_recorrente BOOLEAN DEFAULT false;
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS recorrencia_origem_id UUID REFERENCES public.despesas_operacionais(id) ON DELETE CASCADE;
ALTER TABLE public.despesas_operacionais ADD COLUMN IF NOT EXISTS dia_vencimento_base INTEGER;

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

CREATE INDEX IF NOT EXISTS idx_despesas_competencia ON public.despesas_operacionais (ano_competencia, mes_competencia);
CREATE INDEX IF NOT EXISTS idx_despesas_vencimento ON public.despesas_operacionais (data_vencimento);
CREATE INDEX IF NOT EXISTS idx_despesas_grupo_parcelamento ON public.despesas_operacionais (grupo_parcelamento_id) WHERE grupo_parcelamento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_recorrencia_origem ON public.despesas_operacionais (recorrencia_origem_id) WHERE recorrencia_origem_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_despesas_is_recorrente ON public.despesas_operacionais (is_recorrente) WHERE is_recorrente = true;

DROP TRIGGER IF EXISTS tr_despesas_operacionais_updated_at ON public.despesas_operacionais;
CREATE TRIGGER tr_despesas_operacionais_updated_at BEFORE UPDATE ON public.despesas_operacionais FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. Fechamentos de Caixa Mensal
CREATE TABLE IF NOT EXISTS public.fechamentos_caixa_mensal (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    ano INTEGER NOT NULL,
    saldo_inicial_consolidado NUMERIC(12,2) NOT NULL DEFAULT 0,
    fechado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    CONSTRAINT unique_fechamento_caixa_mes_ano UNIQUE (mes, ano)
);
ALTER TABLE public.fechamentos_caixa_mensal OWNER TO postgres;

DROP TRIGGER IF EXISTS tr_fechamentos_caixa_mensal_updated_at ON public.fechamentos_caixa_mensal;
CREATE TRIGGER tr_fechamentos_caixa_mensal_updated_at BEFORE UPDATE ON public.fechamentos_caixa_mensal FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. Alocações Temporárias da Retaguarda
CREATE TABLE IF NOT EXISTS public.alocacoes_temporarias (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    reserva_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    titular_ausente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    cliente_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
    unidade_id BIGINT REFERENCES public.unidades_cliente(id) ON DELETE SET NULL,
    data_cobertura DATE NOT NULL,
    alocado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.alocacoes_temporarias OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_alocacoes_data ON public.alocacoes_temporarias (data_cobertura);
CREATE INDEX IF NOT EXISTS idx_alocacoes_reserva ON public.alocacoes_temporarias (reserva_id);

-- 10. Movimentações Avulsas
CREATE TABLE IF NOT EXISTS public.movimentacoes_avulsas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id BIGINT NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
    conta_bancaria_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
    tipo_movimentacao VARCHAR(20) NOT NULL CHECK (tipo_movimentacao IN ('ENTRADA', 'SAIDA')),
    categoria VARCHAR(50) NOT NULL,
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

ALTER TABLE public.movimentacoes_avulsas ADD COLUMN IF NOT EXISTS comprovante_url TEXT;

ALTER TABLE public.movimentacoes_avulsas DROP CONSTRAINT IF EXISTS movimentacoes_avulsas_categoria_check;
ALTER TABLE public.movimentacoes_avulsas ADD CONSTRAINT movimentacoes_avulsas_categoria_check CHECK (
    categoria IN (
        'FRETE_ESPORADICO',
        'RENDIMENTO_APLICACAO',
        'REEMBOLSO_CLIENTE',
        'DOACAO_APORTE',
        'OUTRAS_ENTRADAS',
        'DESPESA_OPERACIONAL_AVULSA',
        'REEMBOLSO_DESPESA',
        'TARIFA_BANCARIA',
        'OUTRAS_SAIDAS',
        'CLIENTE_A_VISTA',
        'REEMBOLSO',
        'OUTRAS_RECEITAS',
        'OUTRAS_DESPESAS'
    )
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_avulsas_comp ON public.movimentacoes_avulsas (ano_competencia, mes_competencia);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_avulsas_data ON public.movimentacoes_avulsas (data_movimentacao);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_avulsas_empresa ON public.movimentacoes_avulsas (empresa_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_avulsas_conta ON public.movimentacoes_avulsas (conta_bancaria_id);

DROP TRIGGER IF EXISTS tr_movimentacoes_avulsas_updated_at ON public.movimentacoes_avulsas;
CREATE TRIGGER tr_movimentacoes_avulsas_updated_at BEFORE UPDATE ON public.movimentacoes_avulsas FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 11. Faturas de Fornecedores de Convênios
CREATE TABLE IF NOT EXISTS public.faturas_fornecedores_convenios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    convenio_id UUID NOT NULL REFERENCES public.convenios(id) ON DELETE CASCADE,
    mes_competencia INTEGER NOT NULL CHECK (mes_competencia >= 1 AND mes_competencia <= 12),
    ano_competencia INTEGER NOT NULL,
    data_vencimento DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_total_fatura NUMERIC(10,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_AUDITORIA', 'APROVADA', 'PAGA', 'GLOSADA')),
    comprovante_url TEXT,
    observacoes TEXT,
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    CONSTRAINT uq_fatura_convenio_competencia UNIQUE (convenio_id, ano_competencia, mes_competencia)
);
ALTER TABLE public.faturas_fornecedores_convenios OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_faturas_convenio_comp ON public.faturas_fornecedores_convenios (convenio_id, ano_competencia, mes_competencia);

DROP TRIGGER IF EXISTS tr_faturas_fornecedores_convenios_updated_at ON public.faturas_fornecedores_convenios;
CREATE TRIGGER tr_faturas_fornecedores_convenios_updated_at BEFORE UPDATE ON public.faturas_fornecedores_convenios FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 12. Bloqueios de Convênios
CREATE TABLE IF NOT EXISTS public.bloqueios_convenios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    convenio_id UUID NULL REFERENCES public.convenios(id) ON DELETE CASCADE,
    motivo TEXT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    criado_por UUID NULL REFERENCES public.usuarios(id)
);
ALTER TABLE public.bloqueios_convenios OWNER TO postgres;

CREATE UNIQUE INDEX IF NOT EXISTS uq_bloqueio_convenio_geral ON public.bloqueios_convenios (colaborador_id) WHERE convenio_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_bloqueio_convenio_especifico ON public.bloqueios_convenios (colaborador_id, convenio_id) WHERE convenio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bloqueios_convenios_colaborador ON public.bloqueios_convenios (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_bloqueios_convenios_convenio ON public.bloqueios_convenios (convenio_id);

-- 13. Permissões do Sistema
INSERT INTO public.permissoes (nome_interno, modulo, descricao) VALUES
('faturamento:ver', 'Faturamento', 'Permite visualizar faturas e medições de clientes'),
('faturamento:editar', 'Faturamento', 'Permite criar, editar faturas e registrar recebimentos'),
('dre:ver', 'DRE', 'Permite visualizar o DRE consolidado e por empresa'),
('fluxo_caixa:ver', 'Fluxo de Caixa', 'Permite visualizar o fluxo de caixa diário'),
('fluxo_caixa:editar', 'Fluxo de Caixa', 'Permite editar saldo inicial e configurações de fluxo'),
('despesas:ver', 'Despesas', 'Permite visualizar despesas operacionais'),
('despesas:editar', 'Despesas', 'Permite gerenciar despesas operacionais e tributárias'),
('retaguarda:ver', 'Retaguarda', 'Permite visualizar monitor de eficiência de reservas'),
('retaguarda:alocar', 'Retaguarda', 'Permite alocar motoboys reservas em rotas'),
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
  AND perm.nome_interno IN (
    'faturamento:ver', 'faturamento:editar',
    'dre:ver',
    'fluxo_caixa:ver', 'fluxo_caixa:editar',
    'despesas:ver', 'despesas:editar',
    'retaguarda:ver', 'retaguarda:alocar',
    'movimentacoes_avulsas:ver', 'movimentacoes_avulsas:editar'
  )
ON CONFLICT DO NOTHING;

-- 14. Grants para todas as tabelas
GRANT ALL ON TABLE public.contas_bancarias TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.faturas_clientes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.lotes_recebimento TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.fatura_recebimentos TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.transferencias_intercompany TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.despesas_operacionais TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.fechamentos_caixa_mensal TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.alocacoes_temporarias TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.movimentacoes_avulsas TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.faturas_fornecedores_convenios TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.bloqueios_convenios TO anon, authenticated, service_role;

SELECT setval('public.permissoes_id_seq', (SELECT MAX(id) FROM public.permissoes));
