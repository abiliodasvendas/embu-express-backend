-- Adiciona colunas de coordenadas nas unidades
ALTER TABLE unidades_cliente 
ADD COLUMN IF NOT EXISTS latitude numeric,
ADD COLUMN IF NOT EXISTS longitude numeric;

-- Adiciona a configuração de tolerância caso não exista
INSERT INTO configuracoes_sistema (chave, valor, descricao)
VALUES (
    'raio_geofencing_metros', 
    '500', 
    'Distância máxima em metros permitida para registrar o ponto em relação à unidade.'
) ON CONFLICT (chave) DO NOTHING;

-- Adiciona a flag de validação de localização nos usuários
ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS validar_localizacao boolean NOT NULL DEFAULT true;

