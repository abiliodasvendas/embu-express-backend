INSERT INTO public.permissoes (nome_interno, modulo, descricao) VALUES
('aniversariantes:ver', 'Colaboradores', 'Permite visualizar alertas e listagem de aniversariantes ativos')
ON CONFLICT (nome_interno) DO UPDATE SET
    modulo = EXCLUDED.modulo,
    descricao = EXCLUDED.descricao;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, perm.id
FROM public.perfis p
CROSS JOIN public.permissoes perm
WHERE p.nome IN ('super_admin', 'ceo')
  AND perm.nome_interno = 'aniversariantes:ver'
ON CONFLICT DO NOTHING;

SELECT setval('public.permissoes_id_seq', (SELECT MAX(id) FROM public.permissoes));
