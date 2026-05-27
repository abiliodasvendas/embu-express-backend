import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import axios from 'axios';

// Carrega as variáveis do .env na raiz do backend
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('ERRO: Credenciais do Supabase não encontradas no .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Nominatim (OpenStreetMap) exige delay de 1 segundo entre as requisições para evitar block
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocode(enderecoCompleto: string) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(enderecoCompleto)}&limit=1`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'EmbuExpressApp/1.0 (scripts de backfill)' // Importante para não ser bloqueado
      }
    });
    
    if (response.data && response.data.length > 0) {
      return {
        lat: parseFloat(response.data[0].lat),
        lon: parseFloat(response.data[0].lon)
      };
    }
    return null;
  } catch (error: any) {
    console.error(`Erro ao geocodificar ${enderecoCompleto}:`, error.message);
    return null;
  }
}

async function run() {
  console.log('🚀 Iniciando sincronização de geolocalização das unidades...');
  
  // Busca apenas unidades que ainda não têm latitude preenchida
  const { data: unidades, error } = await supabase
    .from('unidades_cliente')
    .select('id, nome_unidade, cep, logradouro, numero, bairro, cidade, estado')
    .is('latitude', null);

  if (error) {
    console.error('❌ Erro ao buscar unidades:', error);
    return;
  }

  console.log(`📌 Encontradas ${unidades.length} unidades precisando de geolocalização.`);

  for (const unidade of unidades) {
    const partes = [];
    if (unidade.logradouro) partes.push(unidade.logradouro);
    if (unidade.numero) partes.push(unidade.numero);
    if (unidade.cidade) partes.push(unidade.cidade);
    if (unidade.estado) partes.push(unidade.estado);
    // Ignorando Bairro e CEP pois as vezes o Nominatim confunde. Logradouro + Numero + Cidade + Estado é mais preciso.
    
    const endereco = partes.join(', ');
    console.log(`\n🔍 Buscando Unidade [${unidade.nome_unidade}]: ${endereco}`);
    
    const coords = await geocode(endereco);
    
    if (coords) {
      console.log(`✅ Sucesso: Lat ${coords.lat}, Lon ${coords.lon}`);
      const { error: updateError } = await supabase
        .from('unidades_cliente')
        .update({ latitude: coords.lat, longitude: coords.lon })
        .eq('id', unidade.id);

        if (updateError) console.error(`❌ Erro ao atualizar banco:`, updateError);
    } else {
      console.log(`⚠️ Não encontrado. Será necessário preencher manualmente depois.`);
    }
    
    await sleep(1500); 
  }
  
  console.log('\n✅ Sincronização finalizada!');
}

run();
