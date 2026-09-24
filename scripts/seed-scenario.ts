import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const targetUrl = process.env.SUPABASE_URL;
const targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!targetUrl || !targetKey) {
  console.error("[ERRO] SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidas no .env");
  process.exit(1);
}

// Trava de segurança absoluta para proteção de produção
if (targetUrl.includes("kaiqlublbnysumpohfzz")) {
  console.error("=================================================");
  console.error("  [BLOQUEIO DE SEGURANÇA ATIVADO]");
  console.error("  A URL de destino é o banco de PRODUÇÃO (kaiqlublbnysumpohfzz)!");
  console.error("  O script de seed foi abortado para proteger a integridade dos dados.");
  console.error("=================================================");
  process.exit(1);
}

const targetClient: SupabaseClient = createClient(targetUrl, targetKey, {
  auth: { persistSession: false },
});

const args = process.argv.slice(2);
const cenarioArg = args.find((a) => a.startsWith("--cenario="));
const cenarioName = cenarioArg ? cenarioArg.split("=")[1] : "agosto-2026";
const shouldReset = args.includes("--reset") || args.includes("--clean");

async function chunkedUpsert(
  client: SupabaseClient,
  table: string,
  rows: any[],
  onConflict = "id"
) {
  if (!rows || rows.length === 0) return;

  const CHUNK_SIZE = 100;
  let totalSuccess = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    let chunk = rows.slice(i, i + CHUNK_SIZE);
    let error: any = null;
    let attempts = 0;

    while (attempts < 5) {
      const res = await client.from(table).upsert(chunk, { onConflict });
      error = res.error;
      if (!error) break;

      if (error.message.includes("in the schema cache")) {
        const match = error.message.match(/Could not find the '([^']+)' column/);
        if (match && match[1]) {
          const missingCol = match[1];
          console.warn(`    [Adaptação] Coluna '${missingCol}' ausente na tabela '${table}'. Removendo para compatibilidade...`);
          chunk = chunk.map((item) => {
            const copy = { ...item };
            delete copy[missingCol];
            return copy;
          });
          attempts++;
          continue;
        }
      }
      break;
    }

    if (error) {
      console.error(`  [ERRO ao inserir na tabela '${table}' bloco ${i}-${i + chunk.length}]:`, error.message);
    } else {
      totalSuccess += chunk.length;
    }
  }

  console.log(`  -> ${totalSuccess}/${rows.length} registros inseridos/atualizados com sucesso`);
}

async function ensureAuthUsers(client: SupabaseClient, usuarios: any[]) {
  console.log("  Sincronizando usuários no Supabase Auth...");

  const existingAuthUsers = new Set<string>();
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error || !data || !data.users || data.users.length === 0) break;
    data.users.forEach((u) => existingAuthUsers.add(u.id));
    if (data.users.length < perPage) break;
    page++;
  }

  const missingUsers = usuarios.filter((u) => !existingAuthUsers.has(u.id));
  console.log(`  -> ${existingAuthUsers.size} já existem no Auth, ${missingUsers.length} precisam ser criados`);

  const BATCH = 25;
  let createdCount = 0;
  for (let i = 0; i < missingUsers.length; i += BATCH) {
    const batch = missingUsers.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (u) => {
        try {
          const authEmail = `${u.id}@scenario.local`;
          await client.auth.admin.createUser({
            id: u.id,
            email: authEmail,
            password: "Password123!",
            email_confirm: true,
          });
          createdCount++;
        } catch {
          // Ignora se já existir
        }
      })
    );
  }
  console.log(`  -> ${createdCount} usuários criados com sucesso no Auth`);
}

async function run() {
  console.log("=================================================");
  console.log("  SEEDER DE CENÁRIO REAL - HOMOLOGAÇÃO / DEV     ");
  console.log("=================================================");
  console.log(`Ambiente de Destino: ${targetUrl}`);
  console.log(`Cenário Selecionado: ${cenarioName}`);

  const scenarioFilePath = path.join(
    process.cwd(),
    "scripts",
    "scenarios",
    `cenario-${cenarioName}.json`
  );

  if (!fs.existsSync(scenarioFilePath)) {
    console.error(`[ERRO] Arquivo de cenário não encontrado: ${scenarioFilePath}`);
    console.error("Execute primeiro: npx tsx scripts/extract-scenario.ts");
    process.exit(1);
  }

  const rawData = fs.readFileSync(scenarioFilePath, "utf-8");
  const data = JSON.parse(rawData);

  console.log("\nMetadados do Cenário:");
  console.log(`  Origem: ${data.metadata?.origem}`);
  console.log(`  Data da Extração: ${data.metadata?.extraido_em}`);
  console.log(`  Competência: ${data.metadata?.competencia?.dataInicio} a ${data.metadata?.competencia?.dataFim}`);

  if (shouldReset) {
    console.log("\n[LIMPEZA COMPLETA] Resetando tabelas para sincronização limpa...");
    await targetClient.from("fechamentos_financeiros").delete().neq("id", 0);
    await targetClient.from("confirmacoes_adiantamento").delete().neq("id", 0);
    await targetClient.from("lancamentos_convenios").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await targetClient.from("registros_ponto").delete().neq("id", 0);
    await targetClient.from("ocorrencias").delete().neq("id", 0);
    await targetClient.from("colaborador_cliente_horarios").delete().neq("id", 0);
    await targetClient.from("colaborador_clientes").delete().neq("id", 0);
    await targetClient.from("usuarios").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    console.log("  -> Tabelas dependentes limpas com sucesso");
  }

  console.log("\n1/15 Inserindo 'empresas'...");
  await chunkedUpsert(targetClient, "empresas", data.empresas);

  console.log("2/15 Inserindo 'perfis'...");
  await chunkedUpsert(targetClient, "perfis", data.perfis);

  console.log("3/15 Inserindo 'permissoes'...");
  await chunkedUpsert(targetClient, "permissoes", data.permissoes);

  console.log("4/15 Inserindo 'perfil_permissoes'...");
  await chunkedUpsert(targetClient, "perfil_permissoes", data.perfil_permissoes, "perfil_id,permissao_id");

  console.log("5/15 Inserindo 'clientes'...");
  await chunkedUpsert(targetClient, "clientes", data.clientes);

  console.log("6/15 Inserindo 'unidades_cliente'...");
  await chunkedUpsert(targetClient, "unidades_cliente", data.unidades_cliente);

  console.log("7/15 Sincronizando e inserindo 'usuarios'...");
  await ensureAuthUsers(targetClient, data.usuarios);
  await chunkedUpsert(targetClient, "usuarios", data.usuarios);

  console.log("8/15 Inserindo 'colaborador_clientes'...");
  await chunkedUpsert(targetClient, "colaborador_clientes", data.colaborador_clientes);

  console.log("9/15 Inserindo 'colaborador_cliente_horarios'...");
  await chunkedUpsert(targetClient, "colaborador_cliente_horarios", data.colaborador_cliente_horarios);

  console.log("10/15 Inserindo 'feriados'...");
  await chunkedUpsert(targetClient, "feriados", data.feriados);

  console.log("11/15 Inserindo 'convenios'...");
  await chunkedUpsert(targetClient, "convenios", data.convenios);

  console.log("12/15 Inserindo 'registros_ponto' (Agosto/2026)...");
  await chunkedUpsert(targetClient, "registros_ponto", data.registros_ponto);

  console.log("13/15 Inserindo 'lancamentos_convenios' (Agosto/2026)...");
  await chunkedUpsert(targetClient, "lancamentos_convenios", data.lancamentos_convenios);

  console.log("14/15 Inserindo 'confirmacoes_adiantamento' (Agosto/2026)...");
  await chunkedUpsert(targetClient, "confirmacoes_adiantamento", data.confirmacoes_adiantamento);

  console.log("15/15 Inserindo 'fechamentos_financeiros' (Agosto/2026)...");
  await chunkedUpsert(targetClient, "fechamentos_financeiros", data.fechamentos_financeiros);

  if (data.tipos_ocorrencia && data.tipos_ocorrencia.length > 0) {
    console.log("Extra: Inserindo 'tipos_ocorrencia'...");
    await chunkedUpsert(targetClient, "tipos_ocorrencia", data.tipos_ocorrencia);
  }

  if (data.ocorrencias && data.ocorrencias.length > 0) {
    console.log("Extra: Inserindo 'ocorrencias'...");
    await chunkedUpsert(targetClient, "ocorrencias", data.ocorrencias);
  }

  console.log("\n=================================================");
  console.log("✅ Carga do cenário de Agosto/2026 concluída com sucesso!");
  console.log(`   Ambiente: ${targetUrl}`);
  console.log("=================================================");
}

run().catch((err) => {
  console.error("[ERRO FATAL NO SEED]", err);
  process.exit(1);
});
