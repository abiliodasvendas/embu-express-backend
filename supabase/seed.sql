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
(20, 'ponto:registrar', 'Ponto (Operacional)', 'Iniciar, pausar e finalizar próprio expediente via App'),
(21, 'ponto:admin_ver', 'Ponto (Controle)', 'Visualizar lista e detalhes de pontos da equipe'),
(22, 'ponto:admin_criar', 'Ponto (Controle)', 'Inserir marcação de ponto manualmente no painel'),
(23, 'ponto:admin_editar', 'Ponto (Controle)', 'Alterar ou corrigir horário de uma marcação existente'),
(24, 'ponto:admin_deletar', 'Ponto (Controle)', 'Excluir registro de ponto equivocado')
ON CONFLICT (id) DO NOTHING;

-- 1.2 Bind Basic Permissions to some Profiles as examples (Optional, they can be edited in UI later)
-- CEO (Id 4) gets all permissions
INSERT INTO "public"."perfil_permissoes" ("perfil_id", "permissao_id") VALUES
(4, 1), (4, 2), (4, 3), (4, 4), (4, 5), (4, 6), (4, 7), (4, 8), (4, 9), (4, 10),
(4, 11), (4, 12), (4, 13), (4, 14), (4, 15), (4, 16), (4, 17), (4, 18), (4, 19), (4, 20),
(4, 21), (4, 22), (4, 23), (4, 24)
ON CONFLICT DO NOTHING;

-- 2. Create System Configurations
INSERT INTO "public"."configuracoes_sistema" ("chave", "valor", "descricao") VALUES
('tolerancia_verde_min', '5', 'Tolerância para status VERDE (minutos)'),
('tolerancia_amarelo_min', '15', 'Tolerância para status AMARELO (minutos)'),
('tolerancia_saida_min', '10', 'Tolerância para batida de saída Antecipada/Atrasada (minutos)'),
('limite_he_excessiva_min', '120', 'Limite para alerta de Hora Extra excessiva (minutos)')
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
    "senha_padrao"
) VALUES (
    'e7c2c19c-3b36-402a-9e73-9a3c3c3c3c3c',
    1, -- super_admin
    'Admin Master',
    '03075544574',
    'admin@embuexpress.com.br',
    'ATIVO',
    false
) ON CONFLICT (id) DO NOTHING;
