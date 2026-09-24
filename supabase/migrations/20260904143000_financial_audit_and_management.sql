-- --- FINANCIAL AUDIT & RESTRUCTURE SCHEMA MIGRATION ---
-- Migration Timestamp: 20260904143000

-- 1. Contas Bancárias dos 4 CNPJs
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

-- 2. Alterações em Clientes (Tipo de Cobrança, Glosa e Empresa Emissora Padrão)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tipo_cobranca VARCHAR(50) DEFAULT 'DIARIA_MOTOBOY';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS valor_base NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS valor_diaria_glosa NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_emissora_padrao_id BIGINT REFERENCES public.empresas(id) ON DELETE SET NULL;

-- 3. Faturas Quinzenais dos Clientes
CREATE TABLE IF NOT EXISTS public.faturas_clientes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cliente_id BIGINT NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
    empresa_id BIGINT NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
    mes_competencia INTEGER NOT NULL CHECK (mes_competencia >= 1 AND mes_competencia <= 12),
    ano_competencia INTEGER NOT NULL,
    quinzena INTEGER NOT NULL CHECK (quinzena IN (1, 2)),
    valor_faturado NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_pago NUMERIC(10,2) NOT NULL DEFAULT 0,
    data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
    data_vencimento DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'EM_MEDICAO' CHECK (status IN ('EM_MEDICAO', 'AGUARDANDO_APROVACAO', 'EMITIDA_PENDENTE', 'PAGO_PARCIAL', 'LIQUIDADA', 'CANCELADA')),
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

CREATE INDEX IF NOT EXISTS idx_faturas_competencia ON public.faturas_clientes (ano_competencia, mes_competencia, quinzena);
CREATE INDEX IF NOT EXISTS idx_faturas_empresa ON public.faturas_clientes (empresa_id);
CREATE INDEX IF NOT EXISTS idx_faturas_cliente ON public.faturas_clientes (cliente_id);

-- 4. Lotes de Recebimento (1 Depósito Bancário para múltiplas faturas)
CREATE TABLE IF NOT EXISTS public.lotes_recebimento (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conta_bancaria_destino_id UUID NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE RESTRICT,
    data_deposito DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_total_depositado NUMERIC(10,2) NOT NULL CHECK (valor_total_depositado > 0),
    comprovante_url TEXT,
    observacao TEXT,
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.lotes_recebimento OWNER TO postgres;

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

-- 6. Transferências Intercompany (Conta Corrente entre os 4 CNPJs)
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

-- 7. Despesas Operacionais (Contas a Pagar / DRE / Fluxo de Caixa)
CREATE TABLE IF NOT EXISTS public.despesas_operacionais (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id BIGINT REFERENCES public.empresas(id) ON DELETE RESTRICT,
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('DESPESA_FIXA', 'TRIBUTO_DAS', 'PARCELAMENTO_FISCAL', 'INVESTIMENTO_FINANCIAMENTO', 'DESPESA_FINANCEIRA')),
    descricao TEXT NOT NULL,
    mes_competencia INTEGER NOT NULL CHECK (mes_competencia >= 1 AND mes_competencia <= 12),
    ano_competencia INTEGER NOT NULL,
    valor_previsto NUMERIC(10,2) NOT NULL DEFAULT 0,
    valor_pago NUMERIC(10,2) DEFAULT 0,
    data_vencimento DATE NOT NULL,
    data_pagamento DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'ADIADA', 'PAGO', 'CANCELADO')),
    is_holding BOOLEAN NOT NULL DEFAULT false,
    criado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
ALTER TABLE public.despesas_operacionais OWNER TO postgres;

CREATE INDEX IF NOT EXISTS idx_despesas_competencia ON public.despesas_operacionais (ano_competencia, mes_competencia);
CREATE INDEX IF NOT EXISTS idx_despesas_vencimento ON public.despesas_operacionais (data_vencimento);

-- 8. Fechamentos de Caixa Mensal (Saldo Inicial de Referência para Curva Diária)
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

-- 9. Alocações Temporárias da Retaguarda (Cobertura de Faltas por Reservas)
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

-- 10. Alterações em Vínculos e Convênios Existentes
ALTER TABLE public.colaborador_clientes ADD COLUMN IF NOT EXISTS tipo_alocacao VARCHAR(50) DEFAULT 'PADRAO';
ALTER TABLE public.lancamentos_convenios ADD COLUMN IF NOT EXISTS centro_custo VARCHAR(100);
ALTER TABLE public.lancamentos_convenios ADD COLUMN IF NOT EXISTS veiculo_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_convenios_data_moto ON public.lancamentos_convenios (data_lancamento, moto_embu);
CREATE INDEX IF NOT EXISTS idx_convenios_colab_data ON public.lancamentos_convenios (colaborador_id, data_lancamento);

-- 11. Triggers de updated_at
CREATE TRIGGER tr_contas_bancarias_updated_at BEFORE UPDATE ON public.contas_bancarias FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER tr_faturas_clientes_updated_at BEFORE UPDATE ON public.faturas_clientes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER tr_transferencias_intercompany_updated_at BEFORE UPDATE ON public.transferencias_intercompany FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER tr_despesas_operacionais_updated_at BEFORE UPDATE ON public.despesas_operacionais FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER tr_fechamentos_caixa_mensal_updated_at BEFORE UPDATE ON public.fechamentos_caixa_mensal FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 12. Permissões do Sistema
INSERT INTO public.permissoes (nome_interno, modulo, descricao) VALUES
('faturamento:ver', 'Faturamento', 'Permite visualizar faturas e medições de clientes'),
('faturamento:editar', 'Faturamento', 'Permite criar, editar faturas e registrar recebimentos'),
('dre:ver', 'DRE', 'Permite visualizar o DRE consolidado e por empresa'),
('fluxo_caixa:ver', 'Fluxo de Caixa', 'Permite visualizar o fluxo de caixa diário'),
('fluxo_caixa:editar', 'Fluxo de Caixa', 'Permite editar saldo inicial e configurações de fluxo'),
('despesas:ver', 'Despesas', 'Permite visualizar despesas operacionais'),
('despesas:editar', 'Despesas', 'Permite gerenciar despesas operacionais e tributárias'),
('retaguarda:ver', 'Retaguarda', 'Permite visualizar monitor de eficiência de reservas'),
('retaguarda:alocar', 'Retaguarda', 'Permite alocar motoboys reservas em rotas')
ON CONFLICT (nome_interno) DO UPDATE SET
    modulo = EXCLUDED.modulo,
    descricao = EXCLUDED.descricao;

-- Vincular novas permissões a perfis super_admin e ceo
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
    'retaguarda:ver', 'retaguarda:alocar'
  )
ON CONFLICT DO NOTHING;

-- Grants para Tabelas
GRANT ALL ON TABLE public.contas_bancarias TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.faturas_clientes TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.lotes_recebimento TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.fatura_recebimentos TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.transferencias_intercompany TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.despesas_operacionais TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.fechamentos_caixa_mensal TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.alocacoes_temporarias TO anon, authenticated, service_role;

SELECT setval('public.permissoes_id_seq', (SELECT MAX(id) FROM public.permissoes));
