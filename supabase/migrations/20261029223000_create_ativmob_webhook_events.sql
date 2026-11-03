CREATE TABLE IF NOT EXISTS public.ativmob_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id BIGINT,
    event_code VARCHAR(50),
    event_title VARCHAR(100),
    event_dth TIMESTAMPTZ,
    store_cnpj VARCHAR(20),
    order_number VARCHAR(100),
    invoice_number VARCHAR(100),
    agent_code VARCHAR(50),
    agent_name VARCHAR(255),
    lat NUMERIC(12, 8),
    lng NUMERIC(12, 8),
    codigo_roteiro VARCHAR(100),
    form JSONB DEFAULT '[]'::jsonb,
    raw_payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ativmob_events_event_id ON public.ativmob_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_ativmob_events_order_number ON public.ativmob_webhook_events(order_number);
CREATE INDEX IF NOT EXISTS idx_ativmob_events_invoice_number ON public.ativmob_webhook_events(invoice_number);
CREATE INDEX IF NOT EXISTS idx_ativmob_events_store_cnpj ON public.ativmob_webhook_events(store_cnpj);
CREATE INDEX IF NOT EXISTS idx_ativmob_events_codigo_roteiro ON public.ativmob_webhook_events(codigo_roteiro);
CREATE INDEX IF NOT EXISTS idx_ativmob_events_status ON public.ativmob_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_ativmob_events_created_at ON public.ativmob_webhook_events(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ativmob_events_unique_delivery 
ON public.ativmob_webhook_events(event_id, codigo_roteiro, order_number) 
WHERE event_id IS NOT NULL AND codigo_roteiro IS NOT NULL AND order_number IS NOT NULL;

ALTER TABLE public.ativmob_webhook_events ENABLE ROW LEVEL SECURITY;
