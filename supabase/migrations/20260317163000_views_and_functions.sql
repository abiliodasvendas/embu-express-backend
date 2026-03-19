-- --- FUNCTIONS & TRIGGERS ---

-- AUTOMATION: Automate updated_at updates
CREATE OR REPLACE FUNCTION "public"."handle_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "tr_usuarios_updated_at" BEFORE UPDATE ON "public"."usuarios" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "tr_registros_ponto_updated_at" BEFORE UPDATE ON "public"."registros_ponto" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "tr_colaborador_clientes_updated_at" BEFORE UPDATE ON "public"."colaborador_clientes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "tr_empresas_updated_at" BEFORE UPDATE ON "public"."empresas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "tr_clientes_updated_at" BEFORE UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "tr_registros_pausas_updated_at" BEFORE UPDATE ON "public"."registros_pausas" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "tr_unidades_cliente_updated_at" BEFORE UPDATE ON "public"."unidades_cliente" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();

-- --- VIEWS ---

-- VIEW: v_relatorio_mensal_ponto
-- Atualizada para considerar a tolerância de pausa no cálculo do tempo trabalhado
-- E adiciona a coluna detalhes_calculo que é essencial para o front-end
CREATE OR REPLACE VIEW "public"."v_relatorio_mensal_ponto" AS
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
    rp.colaborador_cliente_id,
    rp.detalhes_calculo,
    c.nome_fantasia AS cliente_nome,
    -- Detalhes de Tempo
    (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(fim_hora, inicio_hora) - inicio_hora))/60), 0) 
     FROM public.registros_pausas WHERE ponto_id = rp.id) AS total_pausas_minutos,
    CASE 
        WHEN rp.saida_hora IS NOT NULL THEN 
            (EXTRACT(EPOCH FROM (rp.saida_hora - rp.entrada_hora))/60) - 
            GREATEST(
                (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(fim_hora, inicio_hora) - inicio_hora))/60), 0) 
                 FROM public.registros_pausas WHERE ponto_id = rp.id),
                COALESCE((rp.detalhes_calculo->'resumo'->>'pausa_configurada')::numeric, 0)
            )
        ELSE 0 
    END AS tempo_trabalhado_minutos,
    (SELECT COUNT(*) FROM public.registros_pausas WHERE ponto_id = rp.id) AS qtd_pausas,
    -- Detalhes de KM
    COALESCE(rp.saida_distancia_trabalho, 0) + 
    (SELECT COALESCE(SUM(distancia_trabalho), 0) FROM public.registros_pausas WHERE ponto_id = rp.id) AS total_km_trabalho,
    (SELECT COALESCE(SUM(distancia_pausa), 0) FROM public.registros_pausas WHERE ponto_id = rp.id) AS total_km_pausa
FROM public.registros_ponto rp
JOIN public.usuarios u ON u.id = rp.usuario_id
LEFT JOIN public.clientes c ON c.id = rp.cliente_id;

-- VIEW: v_auditoria_localizacao
CREATE OR REPLACE VIEW "public"."v_auditoria_localizacao" AS
SELECT 
    rp.id AS ponto_id,
    rp.usuario_id,
    rp.data_referencia,
    rp.entrada_lat,
    rp.entrada_lng,
    rp.entrada_metadata->>'accuracy' AS entrada_precisao,
    rp.saida_lat,
    rp.saida_lng,
    rp.saida_metadata->>'accuracy' AS saida_precisao,
    rp.cliente_id
FROM public.registros_ponto rp;

-- --- GRANTS FOR VIEWS ---
GRANT SELECT ON "public"."v_relatorio_mensal_ponto" TO anon, authenticated, service_role;
GRANT SELECT ON "public"."v_auditoria_localizacao" TO anon, authenticated, service_role;
