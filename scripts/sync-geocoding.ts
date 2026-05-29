import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { unidadeService } from '../src/services/unidade.service.js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERRO: Credenciais do Supabase não encontradas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('🚀 Iniciando sincronização massiva de geolocalização das unidades via Google Maps...');
  console.log('🔄 Buscando todas as unidades cadastradas no banco para atualização...');
  
  const { data: unidades, error } = await supabase
    .from('unidades_cliente')
    .select('id, nome_unidade, cep, logradouro, numero, bairro, cidade, estado');

  if (error) {
    console.error('❌ Erro ao buscar unidades:', error);
    return;
  }

  console.log(`📌 Encontradas ${unidades.length} unidades para geolocalização.`);

  for (const unidade of unidades) {
    console.log(`\n🔍 Processando Unidade [${unidade.nome_unidade}]: "${unidade.logradouro}, ${unidade.numero}, ${unidade.cidade}, ${unidade.estado}"`);
    
    const coords = await unidadeService.geocodeAddress({
      logradouro: unidade.logradouro,
      numero: unidade.numero,
      cidade: unidade.cidade,
      estado: unidade.estado
    });
    
    if (coords) {
      console.log(`✅ Sucesso: Lat ${coords.lat}, Lon ${coords.lon}`);
      const { error: updateError } = await supabase
        .from('unidades_cliente')
        .update({ latitude: coords.lat, longitude: coords.lon })
        .eq('id', unidade.id);

      if (updateError) {
        console.error(`❌ Erro ao atualizar banco para a unidade [${unidade.nome_unidade}]:`, updateError);
      } else {
        console.log(`💾 Banco de dados atualizado com sucesso!`);
      }
    } else {
      console.log(`⚠️ Não foi possível encontrar coordenadas para o endereço.`);
    }
    
    await sleep(200); 
  }
  
  console.log('\n✅ Sincronização massiva finalizada com sucesso!');
}

run();
