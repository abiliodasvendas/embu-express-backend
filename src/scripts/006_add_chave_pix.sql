-- Add chave_pix column to usuarios table
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS chave_pix text;

-- Add comment
COMMENT ON COLUMN public.usuarios.chave_pix IS 'Chave PIX do usuário para recebimento de pagamentos';
