INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES 
    ('dia_desembolso_salarios', '7', 'Dia padrão do mês para desembolso de salários da folha'),
    ('dia_desembolso_convenios', '15', 'Dia padrão do mês para desembolso e pagamento dos convênios'),
    ('dia_desembolso_vales', '20', 'Dia padrão do mês para pagamento de vales (adiantamentos) e DAS')
ON CONFLICT (chave) DO NOTHING;
