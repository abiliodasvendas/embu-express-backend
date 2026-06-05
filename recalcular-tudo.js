import * as dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from "./src/config/supabase.js";
import { pontoService } from "./src/services/ponto.service.js";

async function run() {
    console.log("Iniciando recalculo em lote...");
    let hasMore = true;
    let offset = 2500; // Resuming from last stop
    const limit = 200;
    let totalSucessos = 2115; // Accumulating previous successes
    let totalErros = 385; // Accumulating previous errors

    while (hasMore) {
        let pontos = null;
        let error = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
            const res = await supabaseAdmin
                .from('registros_ponto')
                .select('id')
                .not('saida_hora', 'is', null)
                .range(offset, offset + limit - 1)
                .order('id', { ascending: true });
            
            error = res.error;
            if (!error) {
                pontos = res.data;
                break;
            }
            console.log(`Fetch error on attempt ${attempt}. Retrying in 5 seconds...`);
            await new Promise(r => setTimeout(r, 5000));
        }
            
        if (error) {
            console.error("Erro fatal ao buscar pontos apos 3 tentativas:", error);
            break;
        }

        if (!pontos || pontos.length === 0) {
            hasMore = false;
            break;
        }

        console.log(`Processando lote de ${offset} a ${offset + pontos.length - 1}...`);
        
        for(let i=0; i<pontos.length; i++) {
            const p = pontos[i];
            try {
                await pontoService.updatePonto(p.id, { force_recalculate: true });
                totalSucessos++;
            } catch(e) {
                totalErros++;
            }
        }
        
        offset += limit;
    }
    
    console.log(`Fim do Reprocessamento Global. Sucessos: ${totalSucessos}, Erros: ${totalErros}`);
}

run();
