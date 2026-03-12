-- 1. Insert new permissions using ON CONFLICT to avoid errors if already present
INSERT INTO "public"."permissoes" ("id", "nome_interno", "modulo", "descricao") VALUES
(34, 'ponto:ver_meu', 'Ponto (Pessoal)', 'Visualizar o próprio espelho de ponto'),
(35, 'financeiro:ver_meu', 'Financeiro (Pessoal)', 'Visualizar o próprio extrato financeiro')
ON CONFLICT (nome_interno) DO UPDATE SET 
    modulo = EXCLUDED.modulo,
    descricao = EXCLUDED.descricao;

-- 2. Link permissions to roles ONLY if roles exist (prevents failure during clean reset)
DO $$ 
BEGIN
    -- Motoboy gets personal views
    IF EXISTS (SELECT 1 FROM perfis WHERE id = 3) THEN
        INSERT INTO "public"."perfil_permissoes" ("perfil_id", "permissao_id") 
        VALUES (3, 34), (3, 35) ON CONFLICT DO NOTHING;
    END IF;

    -- Fiscal gets personal views
    IF EXISTS (SELECT 1 FROM perfis WHERE id = 8) THEN
        INSERT INTO "public"."perfil_permissoes" ("perfil_id", "permissao_id") 
        VALUES (8, 34), (8, 35) ON CONFLICT DO NOTHING;
    END IF;

    -- Admins and CEO get all new permissions
    IF EXISTS (SELECT 1 FROM perfis WHERE id = 1) THEN
        INSERT INTO "public"."perfil_permissoes" ("perfil_id", "permissao_id") 
        VALUES (1, 34), (1, 35) ON CONFLICT DO NOTHING;
    END IF;

    IF EXISTS (SELECT 1 FROM perfis WHERE id = 4) THEN
        INSERT INTO "public"."perfil_permissoes" ("perfil_id", "permissao_id") 
        VALUES (4, 34), (4, 35) ON CONFLICT DO NOTHING;
    END IF;
END $$;

