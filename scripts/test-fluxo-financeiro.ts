import "dotenv/config";

import { clientService } from "../src/services/client.service.js";
import { unidadeRepository } from "../src/repositories/unidade.repository.js";
import { faturamentoService } from "../src/services/faturamento.service.js";
import { faturamentoRepository } from "../src/repositories/faturamento.repository.js";
import { convenioAuditoriaService } from "../src/services/convenio-auditoria.service.js";
import { convenioRepository } from "../src/repositories/convenio.repository.js";
import { fluxoCaixaService } from "../src/services/fluxo-caixa.service.js";
import { dreService } from "../src/services/dre.service.js";
import { supabaseAdmin } from "../src/config/supabase.js";
import { TIPO_PERIODO_FATURA, STATUS_FATURA } from "../src/constants/financeiro.enum.js";

async function runTests() {
  console.log("=== INICIANDO BATERIA DE TESTES FINANCEIROS ===");

  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  let faturaCriadaId: string | null = null;

  try {
    // 1. Teste de Clientes e Agregação de Contratos
    console.log("\n[1] Testando listagem de clientes e agregação de unidades...");
    const clientes = await clientService.listClients("true");
    console.log(`✓ Encontrados ${clientes.length} clientes ativos.`);

    if (clientes.length === 0) {
      console.warn("Aviso: Nenhum cliente ativo encontrado para os testes.");
      return;
    }

    const clienteTeste = clientes[0];
    console.log(`Cliente selecionado: ${clienteTeste.nome_fantasia} (ID: ${clienteTeste.id})`);
    console.log(`Valor Total Contrato Agregado: R$ ${clienteTeste.valor_total_contrato}`);

    // 2. Teste de Unidades do Cliente
    console.log("\n[2] Testando listagem e campos contratuais das unidades...");
    let unidades = await unidadeRepository.listByCliente(clienteTeste.id);
    console.log(`✓ O cliente possui ${unidades.length} unidade(s).`);

    let unidadeTeste = unidades[0];
    if (!unidadeTeste) {
      console.log("Criando unidade de teste para o cliente...");
      unidadeTeste = await unidadeRepository.insert({
        cliente_id: clienteTeste.id,
        nome_unidade: "Unidade Matriz Teste",
        razao_social: "Unidade Matriz Teste LTDA",
        cnpj: "11222333000199",
        cep: "06803000",
        logradouro: "Rua Teste",
        numero: "100",
        bairro: "Centro",
        cidade: "Embu das Artes",
        estado: "SP",
        latitude: -23.6489,
        longitude: -46.8522,
        ativo: true,
        valor_contrato_mensal: 5000,
        periodicidade: "QUINZENAL",
        dia_vencimento_padrao: 16,
      });
      console.log(`✓ Unidade de teste criada (ID: ${unidadeTeste.id}).`);
    } else {
      console.log(`Unidade: ${unidadeTeste.nome_unidade} (ID: ${unidadeTeste.id})`);
      console.log(`Valor Contrato Mensal: R$ ${unidadeTeste.valor_contrato_mensal}`);
      console.log(`Periodicidade: ${unidadeTeste.periodicidade}`);
      console.log(`Dia Vencimento Padrão: ${unidadeTeste.dia_vencimento_padrao}`);
    }

    // 3. Teste de Sugestão de Medição para a Unidade
    console.log("\n[3] Testando sugestão de medição baseada na unidade...");
    const sugestao = await faturamentoService.calcularSugestaoMedicao({
      unidadeId: unidadeTeste.id,
      mes,
      ano,
      quinzena: 1,
    });
    console.log(`✓ Sugestão calculada:`, {
      unidade_id: sugestao.unidade_id,
      valor_sugerido: sugestao.valor_sugerido,
      periodicidade: sugestao.periodicidade,
      periodo: sugestao.periodo,
    });

    // 4. Teste de Listagem de Faturas com Previsões Virtuais por Unidade
    console.log("\n[4] Testando listagem de faturas e projeções virtuais...");
    const faturas = await faturamentoService.listFaturas({ mes, ano });
    console.log(`✓ Total de faturas retornadas (reais + virtuais): ${faturas.length}`);

    const faturasUnidade = faturas.filter((f) => f.unidade_id === unidadeTeste.id);
    console.log(`✓ Total de faturas da unidade ${unidadeTeste.id}: ${faturasUnidade.length}`);
    faturasUnidade.forEach((f) => {
      console.log(`  -> ID: ${f.id} | É Previsão: ${f.is_previsao} | Período: ${f.tipo_periodo} #${f.numero_periodo} | Venc: ${f.data_vencimento} | Valor: R$ ${f.valor_faturado}`);
    });

    // 5. Teste de Criação de Fatura Manual com Unidade
    console.log("\n[5] Testando emissão de nova fatura de cobrança para a unidade...");
    const empresas = await faturamentoRepository.listEmpresasAtivas();
    const empresaId = empresas[0]?.id || 1;

    const novaFatura = await faturamentoService.createFatura({
      cliente_id: clienteTeste.id,
      unidade_id: unidadeTeste.id,
      empresa_id: empresaId,
      mes_competencia: mes,
      ano_competencia: ano,
      tipo_periodo: TIPO_PERIODO_FATURA.QUINZENAL,
      numero_periodo: 1,
      quinzena: 1,
      data_emissao: `${ano}-${String(mes).padStart(2, "0")}-01`,
      data_vencimento: `${ano}-${String(mes).padStart(2, "0")}-16`,
      valor_faturado: 2500,
      status: STATUS_FATURA.PENDENTE,
      observacoes: "Fatura de teste de integração",
    });

    faturaCriadaId = novaFatura.id;
    console.log(`✓ Fatura criada com sucesso! ID: ${novaFatura.id}`);
    console.log(`  Cliente: ${novaFatura.cliente_id} | Unidade: ${novaFatura.unidade_id} | Valor: R$ ${novaFatura.valor_faturado} | Status: ${novaFatura.status}`);

    // 6. Teste de Liquidação da Fatura
    console.log("\n[6] Testando liquidação individual da fatura criada...");
    const { data: contasBancarias } = await supabaseAdmin.from("contas_bancarias").select("id").limit(1);
    if (contasBancarias && contasBancarias.length > 0) {
      const contaId = contasBancarias[0].id;
      const liquidada = await faturamentoService.liquidarFaturaIndividual(novaFatura.id, {
        conta_bancaria_id: contaId,
        data_pagamento: `${ano}-${String(mes).padStart(2, "0")}-16`,
        valor_pago: 2500,
        observacao: "Liquidação de teste automatizado",
      });
      console.log(`✓ Fatura liquidada com sucesso! Status final: ${liquidada.status} | Valor Pago: R$ ${liquidada.valor_pago}`);
    } else {
      console.log("Ignorando liquidação por falta de contas bancárias cadastradas.");
    }

    // 7. Teste de Convênios e Auditoria com Vencimento Próprio
    console.log("\n[7] Testando auditoria e regras de convênios...");
    const convenios = await convenioRepository.list("true");
    console.log(`✓ Encontrados ${convenios.length} convênio(s) ativo(s).`);

    if (convenios.length > 0) {
      const conv = convenios[0];
      console.log(`Convênio: ${conv.nome} (ID: ${conv.id})`);
      console.log(`Periodicidade: ${conv.periodicidade} | Dia Vencimento Padrão: ${conv.dia_vencimento_padrao}`);

      const auditoria = await convenioAuditoriaService.getAuditoriaMensal(conv.id, mes, ano);
      console.log(`✓ Auditoria mensal executada com sucesso:`, {
        convenio_id: auditoria.convenio_id,
        convenio_nome: auditoria.convenio_nome,
        total_geral: auditoria.total_geral_lancamentos,
      });

      const resumoGeral = await convenioAuditoriaService.getResumoGeralConvenios(mes, ano);
      console.log(`✓ Resumo geral de convênios executado com sucesso:`, {
        total_consumido_geral: resumoGeral.totais.total_geral_consumido,
        quantidade_convenios: resumoGeral.convenios.length,
      });
    }

    // 8. Teste de Fluxo de Caixa Diário
    console.log("\n[8] Testando projeção diária do fluxo de caixa...");
    const fluxo = await fluxoCaixaService.getFluxoCaixa(mes, ano);
    console.log(`✓ Fluxo de caixa diário gerado:`, {
      entradas_projetadas: fluxo.total_entradas_projetadas,
      entradas_realizadas: fluxo.total_entradas_realizadas,
      saidas_projetadas: fluxo.total_saidas_projetadas,
      saldo_final_projetado: fluxo.saldo_final_projetado,
      total_dias_curva: fluxo.curva_diaria.length,
    });

    const diasComEntrada = fluxo.curva_diaria.filter((d) => d.entradas_projetadas > 0 || d.entradas_realizadas > 0);
    console.log(`✓ Dias do mês com entradas projetadas/realizadas:`, diasComEntrada.map((d) => `Dia ${d.dia}: Proj R$ ${d.entradas_projetadas} / Real R$ ${d.entradas_realizadas}`));

    // 9. Teste do DRE Consolidado
    console.log("\n[9] Testando geração do DRE...");
    const dre = await dreService.getDRE(mes, ano, undefined, "projetado");
    console.log(`✓ DRE gerado com sucesso:`, {
      faturamento_bruto: dre.faturamento_bruto,
      receita_operacional_total: dre.receita_operacional_total,
      lucro_bruto: dre.lucro_bruto,
      margem_bruta: `${dre.margem_bruta_percentual}%`,
      lucro_liquido: dre.lucro_liquido,
    });

    console.log("\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===");
  } catch (error) {
    console.error("\n❌ ERRO DURANTE A EXECUÇÃO DOS TESTES:", error);
    throw error;
  } finally {
    // Limpeza da fatura de teste
    if (faturaCriadaId) {
      console.log(`\nLimpando fatura de teste criada (${faturaCriadaId})...`);
      await supabaseAdmin.from("fatura_recebimentos").delete().eq("fatura_id", faturaCriadaId);
      await supabaseAdmin.from("faturas_clientes").delete().eq("id", faturaCriadaId);
      console.log("✓ Dados de teste limpos.");
    }
  }
}

runTests()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
