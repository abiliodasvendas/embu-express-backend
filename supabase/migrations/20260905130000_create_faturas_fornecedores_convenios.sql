-- Migration: Criação da tabela de faturas de fornecedores de convênios (Auditoria do dia 15)
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

CREATE INDEX IF NOT EXISTS idx_faturas_convenio_comp 
ON public.faturas_fornecedores_convenios (convenio_id, ano_competencia, mes_competencia);

CREATE TRIGGER tr_faturas_fornecedores_convenios_updated_at 
BEFORE UPDATE ON public.faturas_fornecedores_convenios 
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

GRANT ALL ON TABLE public.faturas_fornecedores_convenios TO anon, authenticated, service_role;
