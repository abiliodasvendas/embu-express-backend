-- EMBU EXPRESS SEED FILE

-- 1. Create Roles (Perfis)
INSERT INTO "public"."perfis" ("id", "nome", "descricao") VALUES
(1, 'super_admin', 'Administrador com acesso total ao sistema'),
(2, 'cliente', 'Cliente/Operação do sistema'),
(3, 'motoboy', 'Colaborador/Entregador')
ON CONFLICT (id) DO NOTHING;

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
    '39542391838',
    'admin@embuexpress.com.br',
    'ATIVO',
    false
) ON CONFLICT (id) DO NOTHING;
