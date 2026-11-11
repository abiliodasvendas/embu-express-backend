import "dotenv/config";

import { clientService } from "../src/services/client.service.js";
import { unidadeRepository } from "../src/repositories/unidade.repository.js";
import { faturamentoService } from "../src/services/faturamento.service.js";
import { faturamentoRepository } from "../src/repositories/faturamento.repository.js";
import { despesaService } from "../src/services/despesa.service.js";
import { convenioAuditoriaService } from "../src/services/convenio-auditoria.service.js";
import { convenioRepository } from "../src/repositories/convenio.repository.js";
import { fluxoCaixaService } from "../src/services/fluxo-caixa.service.js";
import { dreService } from "../src/services/dre.service.js";
import { extratoBancarioService } from "../src/services/extrato-bancario.service.js";
import { contasPagarService } from "../src/services/contas-pagar.service.js";
import { financeiroService } from "../src/services/financeiro.service.js";
import { supabaseAdmin } from "../src/config/supabase.js";
import {
  TIPO_PERIODO_FATURA,
  STATUS_FATURA,
  STATUS_DESPESA,
  CATEGORIA_DESPESA,
} from "../src/constants/financeiro.enum.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Falha na asserção: ${message}`);
  }
}

async function runTests() {
  console.log("=== INICIANDO BATERIA DE TESTES FINANCEIROS ===");

  const hoje = new Date();
  const mes = hoje.getMonth() + 1;
  const ano = hoje.getFullYear();

  let faturaCriadaId: string | null = null;
  let despesaCriadaId: string | null = null;

  try {
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

    console.log("\n[2] Testando listagem e campos contratuais das unidades...");
    const unidades = await unidadeRepository.listByCliente(clienteTeste.id);
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
      tipo_periodo: sugestao.tipo_periodo,
      periodo: sugestao.periodo,
    });

    console.log("\n[4] Testando listagem de faturas e projeções virtuais...");
    const faturas = await faturamentoService.listFaturas({ mes, ano });
    console.log(`✓ Total de faturas retornadas (reais + virtuais): ${faturas.length}`);

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
      valor_faturado: 8958,
      status: STATUS_FATURA.PENDENTE,
      observacoes: "Fatura de teste de integração",
    });

    faturaCriadaId = novaFatura.id;
    console.log(`✓ Fatura criada com sucesso! ID: ${novaFatura.id} | Valor Faturado: R$ ${novaFatura.valor_faturado}`);

    console.log("\n[6] Testando liquidação, reversão para PENDENTE sem acumular saldo e edição de valor recebido...");
    const { data: contasBancarias } = await supabaseAdmin.from("contas_bancarias").select("id").limit(1);
    if (contasBancarias && contasBancarias.length > 0) {
      const contaId = contasBancarias[0].id;
      const liquidada1 = await faturamentoService.liquidarFaturaIndividual(novaFatura.id, {
        conta_bancaria_id: contaId,
        data_pagamento: `${ano}-${String(mes).padStart(2, "0")}-16`,
        valor_pago: 10148,
        observacao: "Primeira baixa de teste",
      });
      assert(Number(liquidada1.valor_pago) === 10148, `Esperava valor_pago=10148, recebeu ${liquidada1.valor_pago}`);
      assert(liquidada1.status === STATUS_FATURA.LIQUIDADA, `Esperava status LIQUIDADA, recebeu ${liquidada1.status}`);
      console.log(`✓ 6.1 Primeira liquidação realizada: Status=${liquidada1.status} | Valor Pago=R$ ${liquidada1.valor_pago}`);

      const revertidaViaEdicao = await faturamentoService.updateFatura(novaFatura.id, {
        status: STATUS_FATURA.PENDENTE,
      });
      assert(Number(revertidaViaEdicao.valor_pago) === 0, `Esperava valor_pago=0 ao voltar para PENDENTE, recebeu ${revertidaViaEdicao.valor_pago}`);
      assert((revertidaViaEdicao.recebimentos || []).length === 0, `Esperava 0 recebimentos após reversão, recebeu ${(revertidaViaEdicao.recebimentos || []).length}`);
      console.log(`✓ 6.2 Reversão via updateFatura(status=PENDENTE) limpou valor_pago=R$ ${revertidaViaEdicao.valor_pago} e recebimentos=${(revertidaViaEdicao.recebimentos || []).length}`);

      const liquidada2 = await faturamentoService.liquidarFaturaIndividual(novaFatura.id, {
        conta_bancaria_id: contaId,
        data_pagamento: `${ano}-${String(mes).padStart(2, "0")}-16`,
        valor_pago: 10148,
        observacao: "Segunda baixa após reversão",
      });
      assert(Number(liquidada2.valor_pago) === 10148, `Esperava valor_pago=10148 (sem duplicar para 20296), recebeu ${liquidada2.valor_pago}`);
      assert((liquidada2.recebimentos || []).length === 1, `Esperava 1 recebimento ativo, recebeu ${(liquidada2.recebimentos || []).length}`);
      console.log(`✓ 6.3 Nova baixa após reversão manteve valor exato sem duplicar: Valor Pago=R$ ${liquidada2.valor_pago} | Qtd Recebimentos=${(liquidada2.recebimentos || []).length}`);

      const editadaValorPago = await faturamentoService.updateFatura(novaFatura.id, {
        status: STATUS_FATURA.LIQUIDADA,
        valor_faturado: 8958,
        valor_pago: 9500,
      });
      assert(Number(editadaValorPago.valor_pago) === 9500, `Esperava valor_pago=9500 após edição, recebeu ${editadaValorPago.valor_pago}`);
      const somaRec = (editadaValorPago.recebimentos || []).reduce((acc, r) => acc + Number(r.valor_alocado || 0), 0);
      assert(somaRec === 9500, `Esperava soma de recebimentos=9500 após sincronização, recebeu ${somaRec}`);
      console.log(`✓ 6.4 Edição direta do Valor Recebido no diálogo sincronizou fatura e recebimento: R$ ${editadaValorPago.valor_pago}`);

      const estornada = await faturamentoService.desfazerLiquidacaoFatura(novaFatura.id);
      assert(Number(estornada.valor_pago) === 0, `Esperava valor_pago=0 após desfazerLiquidacaoFatura, recebeu ${estornada.valor_pago}`);
      assert(estornada.status === STATUS_FATURA.PENDENTE, `Esperava status PENDENTE, recebeu ${estornada.status}`);
      console.log(`✓ 6.5 Estorno explícito (desfazerLiquidacaoFatura) concluído: Status=${estornada.status} | Valor Pago=R$ ${estornada.valor_pago}`);

      const liquidadaDiretoViaUpdate = await faturamentoService.updateFatura(novaFatura.id, {
        status: STATUS_FATURA.LIQUIDADA,
        valor_pago: 8958,
      });
      assert(
        liquidadaDiretoViaUpdate.status === STATUS_FATURA.LIQUIDADA &&
          Number(liquidadaDiretoViaUpdate.valor_pago) === 8958 &&
          (liquidadaDiretoViaUpdate.recebimentos || []).length === 1,
        `Esperava criação automática de 1 recebimento ao marcar fatura como LIQUIDADA pelo diálogo de edição, recebeu ${(liquidadaDiretoViaUpdate.recebimentos || []).length}`
      );
      console.log(`✓ 6.6 Liquidação direta via updateFatura criou recebimento bancário automaticamente: Qtd Recebimentos=${(liquidadaDiretoViaUpdate.recebimentos || []).length}`);
      await faturamentoService.desfazerLiquidacaoFatura(novaFatura.id);

      await faturamentoService.liquidarFaturaIndividual(novaFatura.id, {
        conta_bancaria_id: contaId,
        data_pagamento: `${ano}-${String(mes).padStart(2, "0")}-12`,
        valor_pago: 4000,
        observacao: "1a parcial",
      });
      await faturamentoService.liquidarFaturaIndividual(novaFatura.id, {
        conta_bancaria_id: contaId,
        data_pagamento: `${ano}-${String(mes).padStart(2, "0")}-18`,
        valor_pago: 4958,
        observacao: "2a parcial",
      });
      const editadaComDuasParciais = await faturamentoService.updateFatura(novaFatura.id, {
        status: STATUS_FATURA.LIQUIDADA,
        valor_pago: 8958,
        observacoes: "Observação editada preservando parciais",
      });
      assert(
        (editadaComDuasParciais.recebimentos || []).length === 2,
        `Esperava preservar 2 recebimentos parciais ao editar observação sem alterar valor_pago, recebeu ${(editadaComDuasParciais.recebimentos || []).length}`
      );
      console.log(`✓ 6.7 Edição de observação preservou os 2 recebimentos parciais legítimos: Qtd=${(editadaComDuasParciais.recebimentos || []).length}`);
      await faturamentoService.desfazerLiquidacaoFatura(novaFatura.id);
    }

    console.log("\n[7] Testando fluxo de pagamento e estorno de Despesa Operacional...");
    const novaDespesa = await despesaService.create({
      empresa_id: empresaId,
      categoria: CATEGORIA_DESPESA.DESPESA_ADMINISTRATIVA,
      descricao: "Despesa Teste Estorno Automatizado",
      mes_competencia: mes,
      ano_competencia: ano,
      valor_previsto: 450,
      valor_pago: 0,
      data_vencimento: `${ano}-${String(mes).padStart(2, "0")}-20`,
      data_pagamento: null,
      status: STATUS_DESPESA.PENDENTE,
      is_holding: false,
      is_parcelado: false,
      is_recorrente: false,
    });
    despesaCriadaId = novaDespesa.id;

    const despesaPaga = await despesaService.marcarPaga(
      novaDespesa.id,
      `${ano}-${String(mes).padStart(2, "0")}-20`,
      480
    );
    assert(despesaPaga.status === STATUS_DESPESA.PAGO && Number(despesaPaga.valor_pago) === 480, "Falha ao marcar despesa como paga");
    console.log(`✓ 7.1 Despesa marcada como PAGO: Valor Pago=R$ ${despesaPaga.valor_pago}`);

    const despesaRevertidaUpdate = await despesaService.update(novaDespesa.id, {
      status: STATUS_DESPESA.PENDENTE,
    });
    assert(
      despesaRevertidaUpdate.status === STATUS_DESPESA.PENDENTE &&
        Number(despesaRevertidaUpdate.valor_pago) === 0 &&
        despesaRevertidaUpdate.data_pagamento === null,
      "Falha ao zerar valor_pago/data_pagamento na reversão de status da despesa"
    );
    console.log(`✓ 7.2 Reversão de despesa via update(status=PENDENTE) zerou valor_pago=R$ ${despesaRevertidaUpdate.valor_pago}`);

    await despesaService.marcarPaga(novaDespesa.id, `${ano}-${String(mes).padStart(2, "0")}-20`, 450);
    const despesaEstornada = await despesaService.desfazerPagamento(novaDespesa.id);
    assert(
      despesaEstornada.status === STATUS_DESPESA.PENDENTE &&
        Number(despesaEstornada.valor_pago) === 0 &&
        despesaEstornada.data_pagamento === null,
      "Falha ao estornar despesa via desfazerPagamento"
    );
    console.log(`✓ 7.3 Estorno de despesa via desfazerPagamento concluído: Status=${despesaEstornada.status} | Valor Pago=R$ ${despesaEstornada.valor_pago}`);

    console.log("\n[8] Testando auditoria e regras de convênios...");
    const convenios = await convenioRepository.list("true");
    console.log(`✓ Encontrados ${convenios.length} convênio(s) ativo(s).`);

    if (convenios.length > 0) {
      const conv = convenios[0];
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

    console.log("\n[9] Testando projeção diária do fluxo de caixa...");
    const fluxo = await fluxoCaixaService.getFluxoCaixa(mes, ano);
    console.log(`✓ Fluxo de caixa diário gerado:`, {
      entradas_projetadas: fluxo.total_entradas_projetadas,
      entradas_realizadas: fluxo.total_entradas_realizadas,
      saidas_projetadas: fluxo.total_saidas_projetadas,
      saldo_final_projetado: fluxo.saldo_final_projetado,
      total_dias_curva: fluxo.curva_diaria.length,
    });

    console.log("\n[10] Testando geração do DRE...");
    const dre = await dreService.getDRE(mes, ano, undefined, "projetado");
    console.log(`✓ DRE gerado com sucesso:`, {
      faturamento_bruto: dre.faturamento_bruto,
      receita_operacional_total: dre.receita_operacional_total,
      lucro_bruto: dre.lucro_bruto,
      margem_bruta: `${dre.margem_bruta_percentual}%`,
      lucro_liquido: dre.lucro_liquido,
    });

    console.log("\n[11] Testando Contas a Pagar Unificadas, Extrato Bancário e Folha Lote...");
    const contasPagar = await contasPagarService.listar({ mes, ano });
    console.log(`✓ 11.1 Contas a Pagar listadas: ${contasPagar.itens.length} itens | Total a pagar: R$ ${contasPagar.kpis.total_a_pagar_mes}`);

    if (contasBancarias && contasBancarias.length > 0) {
      const extrato = await extratoBancarioService.getExtratoConta(contasBancarias[0].id, mes, ano);
      console.log(`✓ 11.2 Extrato Bancário gerado: Conta=${extrato.conta.banco_nome} | Itens no mês=${extrato.itens.length} | Saldo Final=R$ ${extrato.resumo.saldo_final}`);
    }

    const dashboardFolha = await financeiroService.getDashboardLote(mes, ano);
    console.log(`✓ 11.3 Dashboard Folha em Lote: Colaboradores=${dashboardFolha.totalColaboradores} | Saldo Final Folha=R$ ${dashboardFolha.saldoFinalFolha}`);

    const statusGeral = await financeiroService.getStatusGeral(mes, ano);
    console.log(`✓ 11.4 Status Geral de Fechamento: ${statusGeral.length} colaboradores processados`);

    console.log("\n=== TODOS OS TESTES PASSARAM COM SUCESSO! ===");
  } catch (error) {
    console.error("\n❌ ERRO DURANTE A EXECUÇÃO DOS TESTES:", error);
    throw error;
  } finally {
    if (faturaCriadaId) {
      console.log(`\nLimpando fatura de teste criada (${faturaCriadaId})...`);
      await supabaseAdmin.from("fatura_recebimentos").delete().eq("fatura_id", faturaCriadaId);
      await supabaseAdmin.from("faturas_clientes").delete().eq("id", faturaCriadaId);
    }
    if (despesaCriadaId) {
      console.log(`Limpando despesa de teste criada (${despesaCriadaId})...`);
      await supabaseAdmin.from("despesas_operacionais").delete().eq("id", despesaCriadaId);
    }
    console.log("✓ Dados de teste limpos.");
  }
}

runTests()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
