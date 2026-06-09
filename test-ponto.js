import * as dotenv from 'dotenv';
dotenv.config();

import { supabaseAdmin } from "./src/config/supabase.js";

async function run() {
    const { data: pontos } = await supabaseAdmin
        .from('registros_ponto')
        .select('data_referencia, id, usuario_id, colaborador_cliente_id')
        .in('data_referencia', ['2026-05-24', '2026-05-31']);
        
    for (const p of pontos || []) {
        const { data: link } = await supabaseAdmin
            .from('colaborador_clientes')
            .select('cliente:clientes(nome_fantasia)')
            .eq('id', p.colaborador_cliente_id)
            .single();
            
        console.log(`Point on ${p.data_referencia}: Cliente ${link?.cliente?.nome_fantasia} (Colab: ${p.usuario_id})`);
    }
}

run();
