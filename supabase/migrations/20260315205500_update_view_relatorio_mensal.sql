-- Atualiza a view de relatório mensal para considerar a tolerância de pausa no cálculo do tempo trabalhado
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
                COALESCE(cc.tolerancia_pausa_min, 0)
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
LEFT JOIN public.clientes c ON c.id = rp.cliente_id
LEFT JOIN public.colaborador_clientes cc ON cc.id = rp.colaborador_cliente_id;
