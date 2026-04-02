-- EMBU EXPRESS SEED FILE

-- 1. Create Roles (Perfis)
INSERT INTO "public"."perfis" ("id", "nome", "descricao") VALUES
(1, 'super_admin', 'Administrador com acesso total ao sistema'),
(2, 'cliente', 'Cliente/Operação do sistema'),
(3, 'motoboy', 'Colaborador/Entregador'),
(4, 'ceo', 'CEO'),
(5, 'diretor', 'Diretor'),
(6, 'coordenador', 'Coordenador'),
(7, 'supervisor', 'Supervisor'),
(8, 'fiscal', 'Fiscal'),
(9, 'financeiro_car', 'Financeiro CAR'),
(10, 'financeiro_cap', 'Financeiro CAP'),
(11, 'financeiro_rh', 'Financeiro RH'),
(12, 'organizadora', 'Organizadora')
ON CONFLICT (id) DO NOTHING;

-- 1.1 Create Initial Permissions
INSERT INTO "public"."permissoes" ("id", "nome_interno", "modulo", "descricao") VALUES
(1, 'usuarios:ver', 'Usuários', 'Visualizar lista e detalhes de usuários'),
(2, 'usuarios:criar', 'Usuários', 'Criar novos usuários e colaboradores'),
(3, 'usuarios:editar', 'Usuários', 'Editar dados de usuários existentes'),
(4, 'usuarios:deletar', 'Usuários', 'Excluir ou inativar usuários'),
(5, 'usuarios:status', 'Usuários', 'Ativar ou desativar acesso do colaborador'),
(6, 'perfis:ver', 'Perfis', 'Visualizar lista e permissões de perfis'),
(7, 'perfis:criar', 'Perfis', 'Criar novos perfis de acesso'),
(8, 'perfis:editar', 'Perfis', 'Editar perfis e suas permissões'),
(9, 'perfis:deletar', 'Perfis', 'Excluir perfis do sistema'),
(10, 'clientes:ver', 'Clientes', 'Ver listagem de clientes e dashboard'),
(11, 'clientes:criar', 'Clientes', 'Cadastrar novo cliente'),
(12, 'clientes:editar', 'Clientes', 'Alterar dados do cliente'),
(13, 'clientes:deletar', 'Clientes', 'Remover cliente do sistema'),
(14, 'clientes:status', 'Clientes', 'Pausar/Ativar operações do cliente'),
(15, 'empresas:ver', 'Empresas', 'Ver listagem de empresas'),
(16, 'empresas:criar', 'Empresas', 'Cadastrar nova empresa'),
(17, 'empresas:editar', 'Empresas', 'Alterar dados da empresa'),
(18, 'empresas:deletar', 'Empresas', 'Remover empresa do sistema'),
(19, 'empresas:status', 'Empresas', 'Ativar/desativar empresa'),
(21, 'ponto:admin_ver', 'Ponto (Controle)', 'Visualizar lista e detalhes de atividade da equipe'),
(22, 'ponto:admin_criar', 'Ponto (Controle)', 'Inserir marcação de atividade manualmente no painel'),
(23, 'ponto:admin_editar', 'Ponto (Controle)', 'Alterar ou corrigir horário de uma marcação existente'),
(24, 'ponto:admin_deletar', 'Ponto (Controle)', 'Excluir registro de atividade equivocado'),
(25, 'configuracoes:ver', 'Configuração', 'Visualizar parâmetros do sistema'),
(26, 'configuracoes:editar', 'Configuração', 'Alterar parâmetros globais do sistema'),
(27, 'ocorrencias:ver', 'Ocorrências', 'Visualizar lista de ocorrências'),
(28, 'ocorrencias:criar', 'Ocorrências', 'Registrar nova ocorrência'),
(29, 'ocorrencias:editar', 'Ocorrências', 'Editar ocorrências existentes'),
(30, 'ocorrencias:deletar', 'Ocorrências', 'Remover registros de ocorrência'),
(31, 'financeiro:extrato', 'Financeiro', 'Visualizar extrato mensal'),
(32, 'financeiro:fechar', 'Financeiro', 'Realizar fechamento mensal'),
(33, 'financeiro:pagar', 'Financeiro', 'Marcar fechamento como pago'),
(34, 'ponto:ver_meu', 'Ponto (Pessoal)', 'Visualizar o próprio espelho de atividade'),
(35, 'financeiro:ver_meu', 'Financeiro (Pessoal)', 'Visualizar o próprio extrato financeiro'),
(36, 'feriados:ver', 'Feriados', 'Visualizar listagem de feriados'),
(37, 'feriados:editar', 'Feriados', 'Criar, editar e excluir feriados')
ON CONFLICT (nome_interno) DO UPDATE SET 
    modulo = EXCLUDED.modulo,
    descricao = EXCLUDED.descricao;

-- CEO (Id 4) and Super Admin (Id 1) get all permissions
INSERT INTO "public"."perfil_permissoes" ("perfil_id", "permissao_id") VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9), (1, 10),
(1, 11), (1, 12), (1, 13), (1, 14), (1, 15), (1, 16), (1, 17), (1, 18), (1, 19),
(1, 21), (1, 22), (1, 23), (1, 24), (1, 25), (1, 26), (1, 27), (1, 28), (1, 29), (1, 30), (1, 31), (1, 32), (1, 33), (1, 34), (1, 35), (1, 36), (1, 37),
(4, 1), (4, 2), (4, 3), (4, 4), (4, 5), (4, 6), (4, 7), (4, 8), (4, 9), (4, 10),
(4, 11), (4, 12), (4, 13), (4, 14), (4, 15), (4, 16), (4, 17), (4, 18), (4, 19),
(4, 21), (4, 22), (4, 23), (4, 24), (4, 25), (4, 26), (4, 27), (4, 28), (4, 29), (4, 30), (4, 31), (4, 32), (4, 33), (4, 34), (4, 35), (4, 36), (4, 37),
-- Motoboy (Id 3)
(3, 34), (3, 35),
-- Fiscal (Id 8)
(8, 34), (8, 35)
ON CONFLICT DO NOTHING;

-- 2. Create System Configurations
INSERT INTO "public"."configuracoes_sistema" ("chave", "valor", "descricao") VALUES
('tolerancia_verde_min', '5', 'Tolerância para status VERDE (minutos)'),
('tolerancia_amarelo_min', '15', 'Tolerância para status AMARELO (minutos)'),
('tolerancia_saida_min', '10', 'Tolerância para batida de saída Antecipada/Atrasada (minutos)'),
('limite_he_excessiva_min', '120', 'Limite para alerta de Hora Extra excessiva (minutos)'),
('valor_adicional_feriado', '0', 'Valor em reais adicionado para cada feriado trabalhado')
ON CONFLICT (chave) DO NOTHING;

-- 3. Create Admin Auth User
-- Fixed UUID for the first Admin to ensure consistency across resets
INSERT INTO "auth"."users" (
    "id",
    "instance_id",
    "aud",
    "role",
    "email",
    "encrypted_password",
    "email_confirmed_at",
    "recovery_sent_at",
    "last_sign_in_at",
    "raw_app_meta_data",
    "raw_user_meta_data",
    "created_at",
    "updated_at",
    "confirmation_token",
    "email_change",
    "email_change_token_new",
    "recovery_token"
) VALUES (
    'e7c2c19c-3b36-402a-9e73-9a3c3c3c3c3c', -- Fixed UUID for Dev Admin
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@embuexpress.com.br',
    extensions.crypt('Ogaiht+1', extensions.gen_salt('bf')), -- Password: 'Ogaiht+1'
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"nome":"Admin Master","email":"admin@embuexpress.com.br","email_verified":true}',
    now(),
    now(),
    '',
    '',
    '',
    ''
) ON CONFLICT (id) DO NOTHING;

-- 4. Create Admin Public Profile
INSERT INTO "public"."usuarios" (
    "id",
    "perfil_id",
    "nome_completo",
    "cpf",
    "email",
    "status",
    "senha_padrao",
    "tipo_chave_pix"
) VALUES (
    'e7c2c19c-3b36-402a-9e73-9a3c3c3c3c3c',
    1, -- super_admin
    'Admin Master',
    '03075544574',
    'admin@embuexpress.com.br',
    'ATIVO',
    false,
    'CPF'
) ON CONFLICT (id) DO NOTHING;


-- 5. Create Initial Occurrence Types
INSERT INTO "public"."tipos_ocorrencia" ("id", "descricao", "impacto_financeiro") VALUES
(1, 'Ausência', false),
(2, 'Atraso', false),
(3, 'Bônus Extra', true),
(4, 'Quebra de Equipamento', false),
(5, 'Outros', false),
(6, 'Feriado Trabalhado', true)
ON CONFLICT (id) DO NOTHING;

-- Sync sequences after manual ID inserts
SELECT setval('public.tipos_ocorrencia_id_seq', (SELECT MAX(id) FROM public.tipos_ocorrencia));
SELECT setval('public.roles_id_seq', (SELECT MAX(id) FROM public.perfis));
SELECT setval('public.permissoes_id_seq', (SELECT MAX(id) FROM public.permissoes));
