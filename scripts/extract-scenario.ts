import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const prodUrl = process.env.SUPABASE_PROD_URL;
const prodKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY;

if (!prodUrl || !prodKey) {
  console.error("[ERRO] SUPABASE_PROD_URL e SUPABASE_PROD_SERVICE_ROLE_KEY devem estar definidas no .env");
  process.exit(1);
}

const prodClient: SupabaseClient = createClient(prodUrl, prodKey, {
  auth: { persistSession: false },
});

async function fetchAllRows(
  client: SupabaseClient,
  table: string,
  applyFilter?: (query: any) => any
): Promise<any[]> {
  const PAGE_SIZE = 1000;
  const allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = client.from(table).select("*").range(from, from + PAGE_SIZE - 1);
    if (applyFilter) {
      query = applyFilter(query);
    }

    const { data, error } = await query;
    if (error) {
      console.warn(`[AVISO] Erro ao buscar tabela '${table}': ${error.message}`);
      return allRows;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows.push(...data);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }
  }

  return allRows;
}

async function run() {
  console.log("=================================================");
  console.log("  EXTRATOR DE CENÁRIO REAL - PRODUÇÃO (EMBU)     ");
  console.log("=================================================");
  console.log(`Conectando em Prod: ${prodUrl}`);

  const mes = 8;
  const ano = 2026;
  const dataInicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const dataFim = `${ano}-${String(mes).padStart(2, "0")}-31`;

  console.log(`\nPeríodo de referência: ${dataInicio} até ${dataFim}`);

  console.log("\n1/16 Extraindo 'empresas'...");
  const empresas = await fetchAllRows(prodClient, "empresas");
  console.log(`  -> ${empresas.length} empresas encontradas`);

  console.log("2/16 Extraindo 'perfis'...");
  const perfis = await fetchAllRows(prodClient, "perfis");
  console.log(`  -> ${perfis.length} perfis encontrados`);

  console.log("3/16 Extraindo 'permissoes'...");
  const permissoes = await fetchAllRows(prodClient, "permissoes");
  console.log(`  -> ${permissoes.length} permissões encontradas`);

  console.log("4/16 Extraindo 'perfil_permissoes'...");
  const perfil_permissoes = await fetchAllRows(prodClient, "perfil_permissoes");
  console.log(`  -> ${perfil_permissoes.length} associações encontradas`);

  console.log("5/16 Extraindo 'clientes'...");
  const clientes = await fetchAllRows(prodClient, "clientes");
  console.log(`  -> ${clientes.length} clientes encontrados`);

  console.log("6/16 Extraindo 'unidades_cliente'...");
  const unidades_cliente = await fetchAllRows(prodClient, "unidades_cliente");
  console.log(`  -> ${unidades_cliente.length} unidades encontradas`);

  console.log("7/16 Extraindo 'usuarios'...");
  const usuarios = await fetchAllRows(prodClient, "usuarios");
  console.log(`  -> ${usuarios.length} usuários encontrados`);

  console.log("8/16 Extraindo 'colaborador_clientes'...");
  const colaborador_clientes = await fetchAllRows(prodClient, "colaborador_clientes");
  console.log(`  -> ${colaborador_clientes.length} vínculos contratuais encontrados`);

  console.log("9/16 Extraindo 'colaborador_cliente_horarios'...");
  const colaborador_cliente_horarios = await fetchAllRows(prodClient, "colaborador_cliente_horarios");
  console.log(`  -> ${colaborador_cliente_horarios.length} horários/turnos encontrados`);

  console.log("10/16 Extraindo 'feriados' (2026)...");
  const feriados = await fetchAllRows(prodClient, "feriados", (q) =>
    q.gte("data", "2026-01-01").lte("data", "2026-12-31")
  );
  console.log(`  -> ${feriados.length} feriados encontrados`);

  console.log("11/16 Extraindo 'convenios'...");
  const convenios = await fetchAllRows(prodClient, "convenios");
  console.log(`  -> ${convenios.length} convênios encontrados`);

  console.log("12/16 Extraindo 'registros_ponto' (Agosto/2026)...");
  const registros_ponto = await fetchAllRows(prodClient, "registros_ponto", (q) =>
    q.gte("data_referencia", dataInicio).lte("data_referencia", dataFim)
  );
  console.log(`  -> ${registros_ponto.length} registros de ponto encontrados`);

  console.log("13/16 Extraindo 'pausas'...");
  const pontoIds = registros_ponto.map((p) => p.id);
  let pausas: any[] = [];
  if (pontoIds.length > 0) {
    const CHUNK_SIZE = 500;
    for (let i = 0; i < pontoIds.length; i += CHUNK_SIZE) {
      const chunk = pontoIds.slice(i, i + CHUNK_SIZE);
      const chunkPausas = await fetchAllRows(prodClient, "pausas", (q) => q.in("ponto_id", chunk));
      pausas.push(...chunkPausas);
    }
  }
  console.log(`  -> ${pausas.length} pausas encontradas`);

  console.log("14/16 Extraindo 'lancamentos_convenios' (Agosto/2026)...");
  const lancamentos_convenios = await fetchAllRows(prodClient, "lancamentos_convenios", (q) =>
    q.gte("data_lancamento", dataInicio).lte("data_lancamento", dataFim)
  );
  console.log(`  -> ${lancamentos_convenios.length} lançamentos de convênio encontrados`);

  console.log("15/16 Extraindo 'confirmacoes_adiantamento' (Agosto/2026)...");
  const confirmacoes_adiantamento = await fetchAllRows(prodClient, "confirmacoes_adiantamento", (q) =>
    q.eq("mes", mes).eq("ano", ano)
  );
  console.log(`  -> ${confirmacoes_adiantamento.length} confirmações de adiantamento encontradas`);

  console.log("16/16 Extraindo 'fechamentos_financeiros' (Agosto/2026)...");
  const fechamentos_financeiros = await fetchAllRows(prodClient, "fechamentos_financeiros", (q) =>
    q.eq("mes", mes).eq("ano", ano)
  );
  console.log(`  -> ${fechamentos_financeiros.length} fechamentos financeiros encontrados`);

  console.log("Extraindo 'tipos_ocorrencia'...");
  const tipos_ocorrencia = await fetchAllRows(prodClient, "tipos_ocorrencia");
  console.log(`  -> ${tipos_ocorrencia.length} tipos de ocorrência encontrados`);

  const ocorrencias = await fetchAllRows(prodClient, "ocorrencias", (q) =>
    q.gte("data_ocorrencia", dataInicio).lte("data_ocorrencia", dataFim)
  );
  console.log(`  -> ${ocorrencias.length} ocorrências encontradas`);

  const alocacoes_temporarias = await fetchAllRows(prodClient, "alocacoes_temporarias", (q) =>
    q.gte("data_cobertura", dataInicio).lte("data_cobertura", dataFim)
  );
  console.log(`  -> ${alocacoes_temporarias.length} alocações temporárias encontradas`);

  const payload = {
    metadata: {
      origem: prodUrl,
      cenario: "agosto-2026",
      competencia: { mes, ano, dataInicio, dataFim },
      extraido_em: new Date().toISOString(),
      totais: {
        empresas: empresas.length,
        perfis: perfis.length,
        permissoes: permissoes.length,
        perfil_permissoes: perfil_permissoes.length,
        clientes: clientes.length,
        unidades_cliente: unidades_cliente.length,
        usuarios: usuarios.length,
        colaborador_clientes: colaborador_clientes.length,
        colaborador_cliente_horarios: colaborador_cliente_horarios.length,
        feriados: feriados.length,
        convenios: convenios.length,
        registros_ponto: registros_ponto.length,
        pausas: pausas.length,
        lancamentos_convenios: lancamentos_convenios.length,
        confirmacoes_adiantamento: confirmacoes_adiantamento.length,
        fechamentos_financeiros: fechamentos_financeiros.length,
        tipos_ocorrencia: tipos_ocorrencia.length,
        ocorrencias: ocorrencias.length,
        alocacoes_temporarias: alocacoes_temporarias.length,
      },
    },
    empresas,
    perfis,
    permissoes,
    perfil_permissoes,
    clientes,
    unidades_cliente,
    usuarios,
    colaborador_clientes,
    colaborador_cliente_horarios,
    feriados,
    convenios,
    registros_ponto,
    pausas,
    lancamentos_convenios,
    confirmacoes_adiantamento,
    fechamentos_financeiros,
    tipos_ocorrencia,
    ocorrencias,
    alocacoes_temporarias,
  };

  const scenariosDir = path.join(process.cwd(), "scripts", "scenarios");
  if (!fs.existsSync(scenariosDir)) {
    fs.mkdirSync(scenariosDir, { recursive: true });
  }

  const outputPath = path.join(scenariosDir, "cenario-agosto-2026.json");
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf-8");

  console.log("\n=================================================");
  console.log(`✅ Snapshot de cenário salvo com sucesso em:`);
  console.log(`   ${outputPath}`);
  console.log("=================================================");
}

run().catch((err) => {
  console.error("[ERRO FATAL NA EXTRAÇÃO]", err);
  process.exit(1);
});
