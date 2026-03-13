-- Migration: Add public_id to clientes and update report view
-- Created at: 2026-03-12 18:05:00

-- 1. Adicionar coluna public_id para links externos seguros
ALTER TABLE "public"."clientes" ADD COLUMN IF NOT EXISTS "public_id" uuid DEFAULT gen_random_uuid() NOT NULL;

-- 2. Índice para performance
CREATE UNIQUE INDEX IF NOT EXISTS "idx_clientes_public_id" ON "public"."clientes" ("public_id");

-- 3. Dropar e recriar a View para evitar erro de mudança de ordem/nome de colunas
DROP VIEW IF EXISTS "public"."v_relatorio_mensal_ponto";

CREATE VIEW "public"."v_relatorio_mensal_ponto" AS
SELECT 
    rp.id,
    rp.usuario_id,
    u.nome_completo AS colaborador_nome,
    u.cpf AS colaborador_cpf,
    rp.data_referencia,
    rp.entrada_hora,
    rp.saida_hora,
    rp.saldo_minutos,
    rp.status_entrada,
    rp.status_saida,
    rp.cliente_id,
    c.nome_fantasia AS cliente_nome,
    -- Informações de Turno (Vínculo)
    cc.id AS colaborador_cliente_id,
    cc.hora_inicio AS turno_hora_inicio,
    cc.hora_fim AS turno_hora_fim,
    -- Detalhes de Tempo
    (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(fim_hora, inicio_hora) - inicio_hora))/60), 0) 
     FROM public.registros_pausas WHERE ponto_id = rp.id) AS total_pausas_minutos,
    CASE 
        WHEN rp.saida_hora IS NOT NULL THEN 
            (EXTRACT(EPOCH FROM (rp.saida_hora - rp.entrada_hora))/60) - 
            (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(fim_hora, inicio_hora) - inicio_hora))/60), 0) 
             FROM public.registros_pausas WHERE ponto_id = rp.id)
        ELSE 0 
    END AS tempo_trabalhado_minutos,
    (SELECT COUNT(*) FROM public.registros_pausas WHERE ponto_id = rp.id) AS qtd_pausas,
    -- Detalhes de KM
    COALESCE(rp.saida_distancia_trabalho, 0) + 
    (SELECT COALESCE(SUM(distancia_trabalho), 0) FROM public.registros_pausas WHERE ponto_id = rp.id) AS total_km_trabalho,
    (SELECT COALESCE(SUM(distancia_pausa), 0) FROM public.registros_pausas WHERE ponto_id = rp.id) AS total_km_pausa
FROM public.registros_ponto rp
JOIN public.usuarios u ON u.id = rp.usuario_id
LEFT JOIN public.clientes c ON c.id = rp.cliente_id
LEFT JOIN public.colaborador_clientes cc ON cc.id = rp.colaborador_cliente_id;

-- 4. Re-garantir permissões
GRANT SELECT ON "public"."v_relatorio_mensal_ponto" TO anon, authenticated, service_role;
