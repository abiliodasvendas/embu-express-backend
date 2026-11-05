INSERT INTO public.permissoes (nome_interno, modulo, descricao) VALUES
('contas_bancarias:ver', 'Contas Bancárias', 'Permite visualizar contas bancárias e saldos'),
('contas_bancarias:editar', 'Contas Bancárias', 'Permite cadastrar, editar e excluir contas bancárias')
ON CONFLICT (nome_interno) DO UPDATE SET
    modulo = EXCLUDED.modulo,
    descricao = EXCLUDED.descricao;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id)
SELECT p.id, perm.id
FROM public.perfis p
CROSS JOIN public.permissoes perm
WHERE p.nome IN ('super_admin', 'ceo', 'financeiro_car', 'financeiro_cap', 'financeiro_rh', 'supervisor_de_sistema')
  AND perm.nome_interno IN ('contas_bancarias:ver', 'contas_bancarias:editar')
ON CONFLICT DO NOTHING;

SELECT setval('public.permissoes_id_seq', (SELECT MAX(id) FROM public.permissoes));
