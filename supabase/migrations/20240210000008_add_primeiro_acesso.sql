-- Adiciona a flag de primeiro acesso à tabela de usuários
-- Esta flag será TRUE para usuários criados internamente pelo administrador
-- e forçará a troca de senha no primeiro login.

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha_padrao BOOLEAN DEFAULT FALSE;

-- Comentário explicativo na coluna
COMMENT ON COLUMN usuarios.senha_padrao IS 'Indica se o usuário ainda está usando a senha padrão gerada pelo sistema.';
