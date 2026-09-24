import { supabaseAdmin } from "../config/supabase.js";
import { financeiroService } from "./financeiro.service.js";
import {
  STATUS_DESPESA,
  STATUS_FATURA,
  TIPO_MOVIMENTACAO_AVULSA,
} from "../constants/financeiro.enum.js";

export interface PontoFluxoDia {
  dia: number;
  data: string;
  entradas_projetadas: number;
  entradas_realizadas: number;
  saidas_projetadas: number;
  saidas_realizadas: number;
  saldo_projetado_acumulado: number;
  saldo_realizado_acumulado: number;
  eventos: string[];
}

export interface FluxoCaixaResponse {
  periodo: { mes: number; ano: number };
  saldo_inicial: number;
  saldo_retido_convenios: number;
  total_entradas_projetadas: number;
  total_entradas_realizadas: number;
  total_saidas_projetadas: number;
  total_saidas_realizadas: number;
  saldo_final_projetado: number;
  saldo_final_realizado: number;
  curva_diaria: PontoFluxoDia[];
}

export const fluxoCaixaService = {
  async getFluxoCaixa(mes: number, ano: number): Promise<FluxoCaixaResponse> {
    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFimStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

    const { data: fechamentoCaixa } = await supabaseAdmin
      .from("fechamentos_caixa_mensal")
      .select("saldo_inicial_consolidado")
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    const saldoInicial = Number(fechamentoCaixa?.saldo_inicial_consolidado || 0);

    let mesAnterior = mes - 1;
    let anoAnterior = ano;
    if (mesAnterior === 0) {
      mesAnterior = 12;
      anoAnterior = ano - 1;
    }
    const ultimoDiaMesAnterior = new Date(Date.UTC(anoAnterior, mesAnterior, 0)).getUTCDate();
    const dataInicioMesAntStr = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-01`;
    const dataFimMesAntStr = `${anoAnterior}-${String(mesAnterior).padStart(2, '0')}-${String(ultimoDiaMesAnterior).padStart(2, '0')}`;

    const dashboardFolhaAnt = await financeiroService.getDashboardLote(mesAnterior, anoAnterior);
    const desembolsoSalariosDia07 = Number(dashboardFolhaAnt.restaPagar || dashboardFolhaAnt.totalFolha || 0);

    // B) Convênios fechados do mês anterior a pagar no Dia 15/16
    const { data: conveniosAnt } = await supabaseAdmin
      .from("lancamentos_convenios")
      .select("valor, moto_embu")
      .gte("data_lancamento", dataInicioMesAntStr)
      .lte("data_lancamento", dataFimMesAntStr);

    const totalConveniosDia15 = (conveniosAnt || []).reduce((acc, c) => acc + Number(c.valor || 0), 0);
    const saldoRetidoConvenios = (conveniosAnt || []).filter(c => !c.moto_embu).reduce((acc, c) => acc + Number(c.valor || 0), 0);

    const [confirmacoesRes, linksAtivosRes] = await Promise.all([
      supabaseAdmin
        .from("confirmacoes_adiantamento")
        .select("colaborador_id, valor")
        .eq("mes", mes)
        .eq("ano", ano),
      supabaseAdmin
        .from("colaborador_clientes")
        .select("colaborador_id, valor_adiantamento")
        .is("data_fim", null)
    ]);

    const confirmacoesAtual = confirmacoesRes.data || [];
    const linksAtivos = linksAtivosRes.data || [];

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const diaAtual = hoje.getDate();

    const isMesPassado = anoAtual > ano || (anoAtual === ano && mesAtual > mes);
    const isMesAtual = anoAtual === ano && mesAtual === mes;
    const isPosDia20 = isMesPassado || (isMesAtual && diaAtual > 20);
    const isDia20OuApos = isPosDia20 || (isMesAtual && diaAtual === 20);

    const confirmacoesMap = new Map<string, number>();
    confirmacoesAtual.forEach(c => {
      confirmacoesMap.set(c.colaborador_id, c.valor !== null && c.valor !== undefined ? Number(c.valor) : -1);
    });

    const valesConfiguradosMap = new Map<string, number>();
    linksAtivos.forEach(l => {
      const atual = valesConfiguradosMap.get(l.colaborador_id) || 0;
      valesConfiguradosMap.set(l.colaborador_id, atual + Number(l.valor_adiantamento || 0));
    });

    let totalValesConfirmados = 0;
    confirmacoesMap.forEach((valor, colabId) => {
      if (valor >= 0) {
        totalValesConfirmados += valor;
      } else {
        totalValesConfirmados += valesConfiguradosMap.get(colabId) || 0;
      }
    });

    let totalValesPendentesTeoricos = 0;
    valesConfiguradosMap.forEach((valorConfig, colabId) => {
      if (!confirmacoesMap.has(colabId)) {
        totalValesPendentesTeoricos += valorConfig;
      }
    });

    const valesDia20Projetado = isPosDia20
      ? totalValesConfirmados
      : totalValesConfirmados + totalValesPendentesTeoricos;

    const valesDia20Realizado = isDia20OuApos
      ? totalValesConfirmados
      : 0;

    const { data: despesas } = await supabaseAdmin
      .from("despesas_operacionais")
      .select("*")
      .eq("mes_competencia", mes)
      .eq("ano_competencia", ano)
      .neq("status", STATUS_DESPESA.CANCELADO);

    const { data: faturas } = await supabaseAdmin
      .from("faturas_clientes")
      .select("*, recebimentos:fatura_recebimentos(*)")
      .eq("mes_competencia", mes)
      .eq("ano_competencia", ano)
      .neq("status", STATUS_FATURA.CANCELADA);

    const { data: movAvulsas } = await supabaseAdmin
      .from("movimentacoes_avulsas")
      .select("*")
      .eq("mes_competencia", mes)
      .eq("ano_competencia", ano);

    const mapaDias = new Map<number, {
      entradas_proj: number;
      entradas_real: number;
      saidas_proj: number;
      saidas_real: number;
      eventos: string[];
    }>();

    for (let d = 1; d <= ultimoDiaMes; d++) {
      mapaDias.set(d, {
        entradas_proj: 0,
        entradas_real: 0,
        saidas_proj: 0,
        saidas_real: 0,
        eventos: [],
      });
    }

    const dia07Obj = mapaDias.get(7);
    if (dia07Obj && desembolsoSalariosDia07 > 0) {
      dia07Obj.saidas_proj += desembolsoSalariosDia07;
      dia07Obj.saidas_real += desembolsoSalariosDia07;
      dia07Obj.eventos.push("Pagamento do Salário Restante dos Motoboys");
    }

    const dia15Obj = mapaDias.get(15);
    if (dia15Obj && totalConveniosDia15 > 0) {
      dia15Obj.saidas_proj += totalConveniosDia15;
      dia15Obj.saidas_real += totalConveniosDia15;
      dia15Obj.eventos.push("Pagamento dos Postos e Oficinas (Convênios)");
    }

    const dia20Obj = mapaDias.get(20);
    if (dia20Obj && (valesDia20Projetado > 0 || valesDia20Realizado > 0)) {
      dia20Obj.saidas_proj += valesDia20Projetado;
      dia20Obj.saidas_real += valesDia20Realizado;
      dia20Obj.eventos.push("Pagamento do Vale (Adiantamento) e Impostos");
    }

    (despesas || []).forEach(desp => {
      const diaVenc = parseInt(desp.data_vencimento.split("-")[2], 10);
      const diaObj = mapaDias.get(diaVenc);
      if (diaObj) {
        const valor = Number(desp.valor_previsto || 0);
        if (desp.status !== STATUS_DESPESA.ADIADA) {
          diaObj.saidas_proj += valor;
          if (desp.status === STATUS_DESPESA.PAGO) {
            diaObj.saidas_real += Number(desp.valor_pago || valor);
          }
          diaObj.eventos.push(`${desp.descricao} (R$ ${valor.toFixed(2)})`);
        } else {
          diaObj.eventos.push(`[ADIADA] ${desp.descricao}`);
        }
      }
    });

    (faturas || []).forEach(fat => {
      const diaVenc = parseInt(fat.data_vencimento.split("-")[2], 10);
      const diaObj = mapaDias.get(diaVenc);
      if (diaObj) {
        diaObj.entradas_proj += Number(fat.valor_faturado || 0);
      }

      (fat.recebimentos || []).forEach((rec: { data_recebimento: string; valor_alocado: number }) => {
        const diaRec = parseInt(rec.data_recebimento.split("-")[2], 10);
        const diaRecObj = mapaDias.get(diaRec);
        if (diaRecObj) {
          diaRecObj.entradas_real += Number(rec.valor_alocado || 0);
        }
      });
    });

    (movAvulsas || []).forEach(mov => {
      const diaMov = parseInt(mov.data_movimentacao.split("-")[2], 10);
      const diaObj = mapaDias.get(diaMov);
      if (diaObj) {
        const valor = Number(mov.valor || 0);
        if (mov.tipo_movimentacao === TIPO_MOVIMENTACAO_AVULSA.ENTRADA) {
          diaObj.entradas_proj += valor;
          diaObj.entradas_real += valor;
          diaObj.eventos.push(`[ENTRADA AVULSA] ${mov.descricao} (R$ ${valor.toFixed(2)})`);
        } else {
          diaObj.saidas_proj += valor;
          diaObj.saidas_real += valor;
          diaObj.eventos.push(`[SAÍDA AVULSA] ${mov.descricao} (R$ ${valor.toFixed(2)})`);
        }
      }
    });

    let saldoProjetadoAcum = saldoInicial;
    let saldoRealizadoAcum = saldoInicial;

    let totalEntradasProjetadas = 0;
    let totalEntradasRealizadas = 0;
    let totalSaidasProjetadas = 0;
    let totalSaidasRealizadas = 0;

    const curvaDiaria: PontoFluxoDia[] = [];

    for (let d = 1; d <= ultimoDiaMes; d++) {
      const diaData = mapaDias.get(d)!;
      saldoProjetadoAcum += (diaData.entradas_proj - diaData.saidas_proj);
      saldoRealizadoAcum += (diaData.entradas_real - diaData.saidas_real);

      totalEntradasProjetadas += diaData.entradas_proj;
      totalEntradasRealizadas += diaData.entradas_real;
      totalSaidasProjetadas += diaData.saidas_proj;
      totalSaidasRealizadas += diaData.saidas_real;

      const dataDiaStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      curvaDiaria.push({
        dia: d,
        data: dataDiaStr,
        entradas_projetadas: parseFloat(diaData.entradas_proj.toFixed(2)),
        entradas_realizadas: parseFloat(diaData.entradas_real.toFixed(2)),
        saidas_projetadas: parseFloat(diaData.saidas_proj.toFixed(2)),
        saidas_realizadas: parseFloat(diaData.saidas_real.toFixed(2)),
        saldo_projetado_acumulado: parseFloat(saldoProjetadoAcum.toFixed(2)),
        saldo_realizado_acumulado: parseFloat(saldoRealizadoAcum.toFixed(2)),
        eventos: diaData.eventos,
      });
    }

    return {
      periodo: { mes, ano },
      saldo_inicial: parseFloat(saldoInicial.toFixed(2)),
      saldo_retido_convenios: parseFloat(saldoRetidoConvenios.toFixed(2)),
      total_entradas_projetadas: parseFloat(totalEntradasProjetadas.toFixed(2)),
      total_entradas_realizadas: parseFloat(totalEntradasRealizadas.toFixed(2)),
      total_saidas_projetadas: parseFloat(totalSaidasProjetadas.toFixed(2)),
      total_saidas_realizadas: parseFloat(totalSaidasRealizadas.toFixed(2)),
      saldo_final_projetado: parseFloat(saldoProjetadoAcum.toFixed(2)),
      saldo_final_realizado: parseFloat(saldoRealizadoAcum.toFixed(2)),
      curva_diaria: curvaDiaria,
    };
  },

  async setSaldoInicial(mes: number, ano: number, saldoInicial: number, fechadoPor?: string) {
    const { data: updated, error } = await supabaseAdmin
      .from("fechamentos_caixa_mensal")
      .upsert({
        mes,
        ano,
        saldo_inicial_consolidado: saldoInicial,
        fechado_por: fechadoPor || null,
      }, { onConflict: "mes,ano" })
      .select()
      .single();

    if (error) throw error;
    return updated;
  },
};
