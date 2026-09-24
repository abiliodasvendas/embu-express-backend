import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../errors/AppError.js";
import { AlocacaoTemporaria } from "../types/database.js";
import { z } from "zod";
import { alocacaoTemporariaSchema } from "../schemas/retaguarda.schema.js";
import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";
import { ROLES } from "../constants/permissions.enum.js";
import { NIVEL_RISCO_VALE, CLIENTES_ESPECIAIS, NivelRiscoValeType } from "../constants/financeiro.enum.js";

type CreateAlocacaoDTO = z.infer<typeof alocacaoTemporariaSchema>;

export interface MonitorReservaItem {
  colaborador_id: string;
  nome_completo: string;
  tipo_alocacao: "RESERVA" | "FISCAL" | "INTERNO";
  turno_descricao: string;
  salario_mensal: number;
  custo_diaria: number;
  dias_uteis_mes: number;
  dias_alocados: number;
  dias_ociosos: number;
  prejuizo_ociosidade: number;
}

export interface AlertaRiscoValeItem {
  colaborador_id: string;
  nome_completo: string;
  salario_base: number;
  vale_configurado: number;
  adiantamento_confirmado: boolean;
  valor_adiantamento_confirmado: number | null;
  valor_adiantamento_aplicado: number;
  faltas_1a_quinzena: number;
  valor_desconto_faltas: number;
  convenios_1a_quinzena: number;
  saldo_projetado_dia_07: number;
  nivel_risco: NivelRiscoValeType;
  sugestao_vale_seguro: number;
}

export const retaguardaService = {
  async getMonitorReservas(mes: number, ano: number): Promise<{
    totais: {
      total_reservas: number;
      total_fiscais: number;
      custo_total_retaguarda: number;
      prejuizo_total_ociosidade: number;
    };
    itens: MonitorReservaItem[];
  }> {
    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFimStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

    let diasUteis = 0;
    for (let d = 1; d <= ultimoDiaMes; d++) {
      const diaSemana = new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
      if (diaSemana !== 0) diasUteis++;
    }
    if (diasUteis === 0) diasUteis = 26;

    const { data: clienteInterno } = await supabaseAdmin
      .from("clientes")
      .select("id")
      .ilike("nome_fantasia", `%${CLIENTES_ESPECIAIS.INTERNO}%`)
      .maybeSingle();

    const clienteInternoId = clienteInterno?.id || 38;

    const { data: linksRetaguarda, error } = await supabaseAdmin
      .from("colaborador_clientes")
      .select("*, colaborador:usuarios!inner(id, nome_completo, perfil_id, status, perfil:perfis!inner(nome)), horarios:colaborador_cliente_horarios(*)")
      .eq("cliente_id", clienteInternoId)
      .eq("colaborador.status", CADASTRO_STATUS.ATIVO)
      .ilike("colaborador.perfil.nome", ROLES.MOTOBOY)
      .or(`data_fim.is.null,data_fim.gte.${dataInicioStr}`);

    if (error) throw error;

    const { data: alocacoes } = await supabaseAdmin
      .from("alocacoes_temporarias")
      .select("reserva_id, data_cobertura")
      .gte("data_cobertura", dataInicioStr)
      .lte("data_cobertura", dataFimStr);

    const alocacoesMap = new Map<string, Set<string>>();
    (alocacoes || []).forEach(a => {
      if (!alocacoesMap.has(a.reserva_id)) alocacoesMap.set(a.reserva_id, new Set());
      alocacoesMap.get(a.reserva_id)!.add(a.data_cobertura);
    });

    const { data: pontos } = await supabaseAdmin
      .from("registros_ponto")
      .select("usuario_id, data_referencia, cliente_id")
      .gte("data_referencia", dataInicioStr)
      .lte("data_referencia", dataFimStr);

    const pontosMap = new Map<string, Set<string>>();
    (pontos || []).forEach(p => {
      if (!pontosMap.has(p.usuario_id)) pontosMap.set(p.usuario_id, new Set());
      pontosMap.get(p.usuario_id)!.add(p.data_referencia);
    });

    // Agrupar por colaborador unico
    const colabsMap = new Map<string, { colab: { id: string; nome_completo: string | null } | null; salario: number }>();
    (linksRetaguarda || []).forEach(link => {
      const colabId = link.colaborador_id;
      const salarioAtual = Number(link.valor_contrato || 0);
      if (!colabsMap.has(colabId) || salarioAtual > colabsMap.get(colabId)!.salario) {
        colabsMap.set(colabId, { colab: link.colaborador, salario: salarioAtual });
      }
    });

    let custoTotal = 0;
    let prejuizoTotal = 0;

    const itens: MonitorReservaItem[] = Array.from(colabsMap.entries()).map(([colabId, { colab, salario }]) => {
      const custoDiaria = diasUteis > 0 ? salario / diasUteis : 0;
      custoTotal += salario;

      const diasAlocadosSet = new Set<string>([
        ...(alocacoesMap.get(colabId) || []),
        ...(pontosMap.get(colabId) || []),
      ]);
      const diasAlocados = diasAlocadosSet.size;
      const diasOciosos = Math.max(0, diasUteis - diasAlocados);
      const prejuizo = diasOciosos * custoDiaria;
      prejuizoTotal += prejuizo;

      return {
        colaborador_id: colabId,
        nome_completo: colab?.nome_completo || "Motoboy Interno",
        tipo_alocacao: CLIENTES_ESPECIAIS.INTERNO,
        turno_descricao: "Integral (Base Embu / Reserva)",
        salario_mensal: parseFloat(salario.toFixed(2)),
        custo_diaria: parseFloat(custoDiaria.toFixed(2)),
        dias_uteis_mes: diasUteis,
        dias_alocados: diasAlocados,
        dias_ociosos: diasOciosos,
        prejuizo_ociosidade: parseFloat(prejuizo.toFixed(2)),
      };
    });

    return {
      totais: {
        total_reservas: itens.length,
        total_fiscais: 0,
        custo_total_retaguarda: parseFloat(custoTotal.toFixed(2)),
        prejuizo_total_ociosidade: parseFloat(prejuizoTotal.toFixed(2)),
      },
      itens,
    };
  },

  async criarAlocacaoTemporaria(data: CreateAlocacaoDTO, alocadoPor?: string): Promise<AlocacaoTemporaria> {
    const { data: inserted, error } = await supabaseAdmin
      .from("alocacoes_temporarias")
      .insert([{
        ...data,
        alocado_por: alocadoPor || null,
      }])
      .select("*, reserva:usuarios!reserva_id(id, nome_completo), cliente:clientes(id, nome_fantasia)")
      .single();

    if (error) throw error;
    return inserted;
  },

  async listAlocacoes(dataStr?: string): Promise<AlocacaoTemporaria[]> {
    let query = supabaseAdmin
      .from("alocacoes_temporarias")
      .select("*, reserva:usuarios!reserva_id(id, nome_completo), titular_ausente:usuarios!titular_ausente_id(id, nome_completo), cliente:clientes(id, nome_fantasia), unidade:unidades_cliente(id, nome_unidade)")
      .order("data_cobertura", { ascending: false });

    if (dataStr) query = query.eq("data_cobertura", dataStr);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAlertaRiscoVales(mes: number, ano: number): Promise<AlertaRiscoValeItem[]> {
    const dataInicioQuinzena = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const dataFimQuinzena = `${ano}-${String(mes).padStart(2, '0')}-15`;

    const { data: perfilMotoboy } = await supabaseAdmin
      .from("perfis")
      .select("id")
      .ilike("nome", ROLES.MOTOBOY)
      .maybeSingle();

    const perfilMotoboyId = perfilMotoboy?.id || 3;

    const [colaboradoresRes, pontosRes, feriadosRes, conveniosRes, confirmacoesRes] = await Promise.all([
      supabaseAdmin
        .from("usuarios")
        .select("id, nome_completo, links:colaborador_clientes(id, cliente_id, valor_contrato, ajuda_custo, valor_aluguel, valor_adiantamento, data_inicio, data_fim, horarios:colaborador_cliente_horarios(dia_semana))")
        .eq("status", CADASTRO_STATUS.ATIVO)
        .eq("perfil_id", perfilMotoboyId),
      supabaseAdmin
        .from("registros_ponto")
        .select("usuario_id, data_referencia, colaborador_cliente_id, cliente_id")
        .gte("data_referencia", dataInicioQuinzena)
        .lte("data_referencia", dataFimQuinzena),
      supabaseAdmin
        .from("feriados")
        .select("data")
        .gte("data", dataInicioQuinzena)
        .lte("data", dataFimQuinzena),
      supabaseAdmin
        .from("lancamentos_convenios")
        .select("colaborador_id, valor, moto_embu")
        .eq("moto_embu", false)
        .gte("data_lancamento", dataInicioQuinzena)
        .lte("data_lancamento", dataFimQuinzena),
      supabaseAdmin
        .from("confirmacoes_adiantamento")
        .select("colaborador_id, valor, data_confirmacao")
        .eq("mes", mes)
        .eq("ano", ano)
    ]);

    const feriadosSet = new Set((feriadosRes.data || []).map(f => f.data));

    const pontosPorColab = new Map<string, Array<{ data_referencia: string; colaborador_cliente_id: number | null; cliente_id: number | null }>>();
    (pontosRes.data || []).forEach(p => {
      if (!pontosPorColab.has(p.usuario_id)) pontosPorColab.set(p.usuario_id, []);
      pontosPorColab.get(p.usuario_id)!.push({
        data_referencia: p.data_referencia,
        colaborador_cliente_id: p.colaborador_cliente_id,
        cliente_id: p.cliente_id
      });
    });

    const conveniosMap = new Map<string, number>();
    (conveniosRes.data || []).forEach(c => {
      if (!c.colaborador_id) return;
      const atual = conveniosMap.get(c.colaborador_id) || 0;
      conveniosMap.set(c.colaborador_id, atual + Number(c.valor));
    });

    const confirmacoesMap = new Map<string, { valor: number | null; data_confirmacao: string }>();
    (confirmacoesRes.data || []).forEach(c => {
      confirmacoesMap.set(c.colaborador_id, {
        valor: c.valor !== null && c.valor !== undefined ? Number(c.valor) : null,
        data_confirmacao: c.data_confirmacao
      });
    });

    const alertas: AlertaRiscoValeItem[] = [];

    (colaboradoresRes.data || []).forEach(colab => {
      type HorarioItem = { dia_semana: number };
      type LinkItem = {
        id: number;
        cliente_id: number;
        valor_contrato: number | null;
        ajuda_custo: number | null;
        valor_aluguel: number | null;
        valor_adiantamento: number | null;
        data_inicio: string | null;
        data_fim: string | null;
        horarios?: HorarioItem[];
      };

      const links = (colab.links as unknown as LinkItem[]) || [];
      const linksAtivos = links.filter(l => !l.data_fim || l.data_fim >= dataInicioQuinzena);
      if (linksAtivos.length === 0) return;

      const valeConfigurado = linksAtivos.reduce((acc, l) => acc + Number(l.valor_adiantamento || 0), 0);
      const confirmacao = confirmacoesMap.get(colab.id);
      const adiantamentoConfirmado = !!confirmacao;

      if (valeConfigurado === 0 && !adiantamentoConfirmado) {
        return;
      }

      const valorAdiantamentoConfirmado = confirmacao
        ? (confirmacao.valor !== null ? confirmacao.valor : valeConfigurado)
        : null;
      const valorAdiantamentoAplicado = adiantamentoConfirmado
        ? (valorAdiantamentoConfirmado ?? valeConfigurado)
        : valeConfigurado;

      const pontosColab = pontosPorColab.get(colab.id) || [];

      let salarioBaseTotal = 0;
      let faltasQuinzenaTotal = 0;
      let valorDescontoFaltasTotal = 0;

      for (const link of linksAtivos) {
        const baseTurno = Number(link.valor_contrato || 0) + Number(link.ajuda_custo || 0) + Number(link.valor_aluguel || 0);
        salarioBaseTotal += baseTurno;
        const baseQuinzenaTurno = baseTurno / 2;

        let diasEsperadosTurno = 0;
        let faltasTurno = 0;

        for (let d = 1; d <= 15; d++) {
          const dataAtual = new Date(Date.UTC(ano, mes - 1, d));
          const dataStr = dataAtual.toISOString().split("T")[0];
          const diaSemana = dataAtual.getUTCDay();

          const isVigente = (!link.data_inicio || link.data_inicio <= dataStr) && (!link.data_fim || link.data_fim >= dataStr);
          const isDiaEscala = link.horarios && link.horarios.some(h => h.dia_semana === diaSemana);

          if (isVigente && isDiaEscala) {
            diasEsperadosTurno++;

            const isFeriado = feriadosSet.has(dataStr);
            if (!isFeriado) {
              const temPontoTurno = pontosColab.some(p =>
                p.data_referencia === dataStr &&
                (p.colaborador_cliente_id === link.id || (!p.colaborador_cliente_id && p.cliente_id === link.cliente_id))
              );

              if (!temPontoTurno) {
                faltasTurno++;
              }
            }
          }
        }

        const valorDiariaTurno = diasEsperadosTurno > 0 ? baseQuinzenaTurno / diasEsperadosTurno : 0;
        const descontoTurno = faltasTurno * valorDiariaTurno;

        faltasQuinzenaTotal += faltasTurno;
        valorDescontoFaltasTotal += descontoTurno;
      }

      const conveniosConsumidos = conveniosMap.get(colab.id) || 0;
      const saldoProjetado = salarioBaseTotal - valorDescontoFaltasTotal - conveniosConsumidos - valorAdiantamentoAplicado;

      let nivelRisco: NivelRiscoValeType = NIVEL_RISCO_VALE.NORMAL;

      if (!adiantamentoConfirmado) {
        if (saldoProjetado < 0) {
          nivelRisco = NIVEL_RISCO_VALE.RISCO_ALTO;
        } else if (saldoProjetado < 300) {
          nivelRisco = NIVEL_RISCO_VALE.RISCO_MEDIO;
        } else {
          nivelRisco = NIVEL_RISCO_VALE.NORMAL;
        }
      } else {
        if (saldoProjetado < 0) {
          nivelRisco = NIVEL_RISCO_VALE.RISCO_ALTO;
        } else if (saldoProjetado < 300) {
          nivelRisco = NIVEL_RISCO_VALE.AJUSTADO_MARGEM_CRITICA;
        } else {
          nivelRisco = NIVEL_RISCO_VALE.TRATADO_SEGURO;
        }
      }

      const sugestaoValeSeguro = Math.max(0, parseFloat((salarioBaseTotal - valorDescontoFaltasTotal - conveniosConsumidos - 300).toFixed(2)));

      alertas.push({
        colaborador_id: colab.id,
        nome_completo: colab.nome_completo,
        salario_base: parseFloat(salarioBaseTotal.toFixed(2)),
        vale_configurado: parseFloat(valeConfigurado.toFixed(2)),
        adiantamento_confirmado: adiantamentoConfirmado,
        valor_adiantamento_confirmado: valorAdiantamentoConfirmado !== null ? parseFloat(valorAdiantamentoConfirmado.toFixed(2)) : null,
        valor_adiantamento_aplicado: parseFloat(valorAdiantamentoAplicado.toFixed(2)),
        faltas_1a_quinzena: faltasQuinzenaTotal,
        valor_desconto_faltas: parseFloat(valorDescontoFaltasTotal.toFixed(2)),
        convenios_1a_quinzena: parseFloat(conveniosConsumidos.toFixed(2)),
        saldo_projetado_dia_07: parseFloat(saldoProjetado.toFixed(2)),
        nivel_risco: nivelRisco,
        sugestao_vale_seguro: sugestaoValeSeguro,
      });
    });

    return alertas.sort((a, b) => {
      const prioridade = (item: AlertaRiscoValeItem) => {
        if (!item.adiantamento_confirmado) {
          if (item.nivel_risco === NIVEL_RISCO_VALE.RISCO_ALTO) return 1;
          if (item.nivel_risco === NIVEL_RISCO_VALE.RISCO_MEDIO) return 2;
          return 3;
        }
        if (item.nivel_risco === NIVEL_RISCO_VALE.AJUSTADO_MARGEM_CRITICA) return 4;
        if (item.nivel_risco === NIVEL_RISCO_VALE.RISCO_ALTO) return 5;
        return 6;
      };
      const diffPrioridade = prioridade(a) - prioridade(b);
      if (diffPrioridade !== 0) return diffPrioridade;
      return a.saldo_projetado_dia_07 - b.saldo_projetado_dia_07;
    });
  },
};
