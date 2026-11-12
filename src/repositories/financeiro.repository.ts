import { supabaseAdmin } from "../config/supabase.js";
import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";
import { ROLES } from "../constants/permissions.enum.js";
import {
  ConfirmacaoAdiantamentoPayload,
  FechamentoPayload,
} from "../types/financeiro.type.js";
import { Ocorrencia } from "../types/database.js";

export interface ConfirmacaoAdiantamentoDb {
  id: number;
  colaborador_id: string;
  mes: number;
  ano: number;
  valor?: number | null;
  confirmado_por: string;
  data_confirmacao: string;
  conta_bancaria_id?: string | null;
  data_pagamento?: string | null;
  lote_pagamento_id?: string | null;
}

export interface FechamentoFinanceiroDb {
  id: number;
  colaborador_id: string;
  mes: number;
  ano: number;
  saldo_final: number;
  fechado_por: string;
  data_fechamento: string;
  pago: boolean;
  data_pagamento: string;
  conta_bancaria_id?: string | null;
  lote_pagamento_id?: string | null;
  resumo_json?: unknown;
  created_at?: string;
}

export interface ColaboradorClienteDb {
  colaborador_id: string;
  valor_adiantamento: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  cliente: { nome_fantasia: string }[] | { nome_fantasia: string } | null;
}

export interface ColaboradorElegivelMesRow {
  id: string;
  nome_completo: string;
  email: string;
  status: string | null;
  valor_mei: number | null;
}

export const financeiroRepository = {
  async obterPerfilMotoboyId(): Promise<number> {
    const { data: perfilMotoboy } = await supabaseAdmin
      .from("perfis")
      .select("id")
      .ilike("nome", ROLES.MOTOBOY)
      .maybeSingle();

    return perfilMotoboy?.id || 3;
  },

  async listarColaboradoresElegiveisMes(params: {
    mes: number;
    ano: number;
    dataInicioMesStr: string;
    dataFimMesStr: string;
  }): Promise<ColaboradorElegivelMesRow[]> {
    const { mes, ano, dataInicioMesStr, dataFimMesStr } = params;
    const perfilMotoboyId = await this.obterPerfilMotoboyId();

    const [motoboysRes, fechamentosMesRes, confirmacoesMesRes] = await Promise.all([
      supabaseAdmin
        .from("usuarios")
        .select("id, nome_completo, email, status, valor_mei")
        .in("status", [CADASTRO_STATUS.ATIVO, CADASTRO_STATUS.INATIVO])
        .eq("perfil_id", perfilMotoboyId)
        .order("nome_completo", { ascending: true }),
      supabaseAdmin
        .from("fechamentos_financeiros")
        .select("colaborador_id")
        .eq("mes", mes)
        .eq("ano", ano),
      supabaseAdmin
        .from("confirmacoes_adiantamento")
        .select("colaborador_id")
        .eq("mes", mes)
        .eq("ano", ano),
    ]);

    if (motoboysRes.error) throw motoboysRes.error;
    const todosMotoboys = motoboysRes.data || [];
    const motoboyIdsSet = new Set(todosMotoboys.map((u) => u.id));

    const idsComMovimentoNoMes = new Set<string>();
    (fechamentosMesRes.data || []).forEach((f) => idsComMovimentoNoMes.add(f.colaborador_id));
    (confirmacoesMesRes.data || []).forEach((c) => idsComMovimentoNoMes.add(c.colaborador_id));

    const idsOutrosPerfis = Array.from(idsComMovimentoNoMes).filter(
      (id) => !motoboyIdsSet.has(id)
    );

    let usuariosOutrosPerfis: ColaboradorElegivelMesRow[] = [];
    if (idsOutrosPerfis.length > 0) {
      const { data: extrasData, error: extrasError } = await supabaseAdmin
        .from("usuarios")
        .select("id, nome_completo, email, status, valor_mei")
        .in("id", idsOutrosPerfis);
      if (extrasError) throw extrasError;
      usuariosOutrosPerfis = extrasData || [];
    }

    const inativos = todosMotoboys.filter((u) => u.status === CADASTRO_STATUS.INATIVO);
    const idsInativosComAtividade = new Set<string>();

    inativos.forEach((u) => {
      if (idsComMovimentoNoMes.has(u.id)) {
        idsInativosComAtividade.add(u.id);
      }
    });

    const inativosRestantesIds = inativos
      .filter((u) => !idsInativosComAtividade.has(u.id))
      .map((u) => u.id);

    if (inativosRestantesIds.length > 0) {
      const CHUNK_SIZE = 50;
      const chunks: string[][] = [];
      for (let i = 0; i < inativosRestantesIds.length; i += CHUNK_SIZE) {
        chunks.push(inativosRestantesIds.slice(i, i + CHUNK_SIZE));
      }

      await Promise.all(
        chunks.map(async (chunkIds) => {
          const [pontosRes, ocorrenciasRes, conveniosRes] = await Promise.all([
            supabaseAdmin
              .from("registros_ponto")
              .select("usuario_id")
              .in("usuario_id", chunkIds)
              .gte("data_referencia", dataInicioMesStr)
              .lte("data_referencia", dataFimMesStr),
            supabaseAdmin
              .from("ocorrencias")
              .select("colaborador_id, observacao")
              .in("colaborador_id", chunkIds)
              .eq("impacto_financeiro", true)
              .gte("data_ocorrencia", dataInicioMesStr)
              .lte("data_ocorrencia", dataFimMesStr),
            supabaseAdmin
              .from("lancamentos_convenios")
              .select("colaborador_id")
              .in("colaborador_id", chunkIds)
              .eq("moto_embu", false)
              .gte("data_lancamento", dataInicioMesStr)
              .lte("data_lancamento", dataFimMesStr),
          ]);

          (pontosRes.data || []).forEach((p) => idsInativosComAtividade.add(p.usuario_id));
          (ocorrenciasRes.data || []).forEach((o) => {
            if (!o.observacao || !o.observacao.startsWith("Inclusão automática:")) {
              idsInativosComAtividade.add(o.colaborador_id);
            }
          });
          (conveniosRes.data || []).forEach((l) => {
            if (l.colaborador_id) idsInativosComAtividade.add(l.colaborador_id);
          });
        })
      );
    }

    const motoboysElegiveis = todosMotoboys.filter(
      (u) => u.status === CADASTRO_STATUS.ATIVO || idsInativosComAtividade.has(u.id)
    );

    return [...motoboysElegiveis, ...usuariosOutrosPerfis].sort((a, b) =>
      (a.nome_completo || "").localeCompare(b.nome_completo || "")
    );
  },

  async getFechamentoPorCompetencia(
    usuarioId: string,
    mes: number,
    ano: number
  ): Promise<FechamentoFinanceiroDb | null> {
    const { data } = await supabaseAdmin
      .from("fechamentos_financeiros")
      .select("*")
      .eq("colaborador_id", usuarioId)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    return (data as FechamentoFinanceiroDb | null) || null;
  },

  async carregarDadosExtratoIndividual(params: {
    usuarioId: string;
    mes: number;
    ano: number;
    mesAnterior: number;
    anoAnterior: number;
    dataInicioMesStr: string;
    dataFimMesStr: string;
  }) {
    const {
      usuarioId,
      mes,
      ano,
      mesAnterior,
      anoAnterior,
      dataInicioMesStr,
      dataFimMesStr,
    } = params;

    const { data: usuario, error: userError } = await supabaseAdmin
      .from("usuarios")
      .select("valor_mei, status")
      .eq("id", usuarioId)
      .single();

    if (userError) throw userError;

    const { data: links, error: linkError } = await supabaseAdmin
      .from("colaborador_clientes")
      .select("*, cliente:clientes(*), unidade:unidades_cliente(*), horarios:colaborador_cliente_horarios(*)")
      .eq("colaborador_id", usuarioId);

    if (linkError) throw linkError;

    const [
      fechamentoAnteriorRes,
      pontosRes,
      feriadosRes,
      confirmacaoRes,
      conveniosRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("fechamentos_financeiros")
        .select("saldo_final")
        .eq("colaborador_id", usuarioId)
        .eq("mes", mesAnterior)
        .eq("ano", anoAnterior)
        .eq("pago", true)
        .maybeSingle(),
      supabaseAdmin
        .from("registros_ponto")
        .select("*")
        .eq("usuario_id", usuarioId)
        .gte("data_referencia", dataInicioMesStr)
        .lte("data_referencia", dataFimMesStr),
      supabaseAdmin
        .from("feriados")
        .select("data")
        .gte("data", dataInicioMesStr)
        .lte("data", dataFimMesStr),
      supabaseAdmin
        .from("confirmacoes_adiantamento")
        .select("*")
        .eq("colaborador_id", usuarioId)
        .eq("mes", mes)
        .eq("ano", ano)
        .maybeSingle(),
      supabaseAdmin
        .from("lancamentos_convenios")
        .select("*, convenio:convenios(nome)")
        .eq("colaborador_id", usuarioId)
        .eq("moto_embu", false)
        .gte("data_lancamento", dataInicioMesStr)
        .lte("data_lancamento", dataFimMesStr),
    ]);

    return {
      usuario,
      links: links || [],
      fechamentoAnterior: fechamentoAnteriorRes.data,
      pontos: pontosRes.data || [],
      feriadosMes: new Set((feriadosRes.data || []).map((f) => f.data)),
      confirmacaoAdiantamento: confirmacaoRes.data as ConfirmacaoAdiantamentoDb | null,
      lancamentosConvenios: conveniosRes.data || [],
    };
  },

  async carregarResumoPagoDashboardLote(mes: number, ano: number, dataInicioMesStr: string) {
    const [fechamentosRes, todosTurnosRes, todasConfirmacoesRes] = await Promise.all([
      supabaseAdmin
        .from("fechamentos_financeiros")
        .select("colaborador_id, saldo_final, resumo_json")
        .eq("mes", mes)
        .eq("ano", ano)
        .eq("pago", true),
      supabaseAdmin
        .from("colaborador_clientes")
        .select("colaborador_id, valor_adiantamento, data_inicio, data_fim")
        .or(`data_fim.is.null,data_fim.gte.${dataInicioMesStr}`),
      supabaseAdmin
        .from("confirmacoes_adiantamento")
        .select("colaborador_id, valor")
        .eq("mes", mes)
        .eq("ano", ano),
    ]);

    return {
      fechamentos: fechamentosRes.data || [],
      todosTurnos: todosTurnosRes.data || [],
      todasConfirmacoes: todasConfirmacoesRes.data || [],
    };
  },

  async carregarDadosPendentesDashboardLote(params: {
    pendentesIds: string[];
    mes: number;
    ano: number;
    mesAnterior: number;
    anoAnterior: number;
    dataInicioMesStr: string;
    dataFimMesStr: string;
  }) {
    const {
      pendentesIds,
      mes,
      ano,
      mesAnterior,
      anoAnterior,
      dataInicioMesStr,
      dataFimMesStr,
    } = params;

    const CHUNK_SIZE = 50;
    const chunks: string[][] = [];
    for (let i = 0; i < pendentesIds.length; i += CHUNK_SIZE) {
      chunks.push(pendentesIds.slice(i, i + CHUNK_SIZE));
    }

    const linksPorUsuario = new Map<string, Array<Record<string, unknown>>>();
    const ocorrenciasPorUsuario = new Map<string, Ocorrencia[]>();
    const fechamentosAnterioresMap = new Map<string, { saldo_final: number }>();
    const pontosPorUsuario = new Map<string, Array<Record<string, unknown>>>();
    const confirmacoesMap = new Map<string, ConfirmacaoAdiantamentoDb>();
    const conveniosPorUsuario = new Map<string, Array<Record<string, unknown>>>();

    const [feriadosRes] = await Promise.all([
      supabaseAdmin
        .from("feriados")
        .select("data")
        .gte("data", dataInicioMesStr)
        .lte("data", dataFimMesStr),
      ...chunks.map(async (chunkIds) => {
        const [
          linksRes,
          ocorrenciasRes,
          fechamentosAntRes,
          pontosRes,
          confirmacoesRes,
          conveniosRes,
        ] = await Promise.all([
          supabaseAdmin
            .from("colaborador_clientes")
            .select("*, cliente:clientes(*), unidade:unidades_cliente(*), horarios:colaborador_cliente_horarios(*)")
            .in("colaborador_id", chunkIds),
          supabaseAdmin
            .from("ocorrencias")
            .select("*, tipo:tipos_ocorrencia(id, descricao)")
            .in("colaborador_id", chunkIds)
            .gte("data_ocorrencia", dataInicioMesStr)
            .lte("data_ocorrencia", dataFimMesStr),
          supabaseAdmin
            .from("fechamentos_financeiros")
            .select("colaborador_id, saldo_final")
            .in("colaborador_id", chunkIds)
            .eq("mes", mesAnterior)
            .eq("ano", anoAnterior)
            .eq("pago", true),
          supabaseAdmin
            .from("registros_ponto")
            .select("*")
            .in("usuario_id", chunkIds)
            .gte("data_referencia", dataInicioMesStr)
            .lte("data_referencia", dataFimMesStr),
          supabaseAdmin
            .from("confirmacoes_adiantamento")
            .select("*")
            .in("colaborador_id", chunkIds)
            .eq("mes", mes)
            .eq("ano", ano),
          supabaseAdmin
            .from("lancamentos_convenios")
            .select("*, convenio:convenios(nome)")
            .in("colaborador_id", chunkIds)
            .eq("moto_embu", false)
            .gte("data_lancamento", dataInicioMesStr)
            .lte("data_lancamento", dataFimMesStr),
        ]);

        (linksRes.data || []).forEach((l) => {
          if (!linksPorUsuario.has(l.colaborador_id)) linksPorUsuario.set(l.colaborador_id, []);
          linksPorUsuario.get(l.colaborador_id)!.push(l);
        });

        ((ocorrenciasRes.data || []) as unknown as Ocorrencia[]).forEach((o) => {
          if (!ocorrenciasPorUsuario.has(o.colaborador_id)) ocorrenciasPorUsuario.set(o.colaborador_id, []);
          ocorrenciasPorUsuario.get(o.colaborador_id)!.push(o);
        });

        (fechamentosAntRes.data || []).forEach((f) => {
          fechamentosAnterioresMap.set(f.colaborador_id, f);
        });

        (pontosRes.data || []).forEach((p) => {
          if (!pontosPorUsuario.has(p.usuario_id)) pontosPorUsuario.set(p.usuario_id, []);
          pontosPorUsuario.get(p.usuario_id)!.push(p);
        });

        ((confirmacoesRes.data as ConfirmacaoAdiantamentoDb[]) || []).forEach((c) => {
          confirmacoesMap.set(c.colaborador_id, c);
        });

        (conveniosRes.data || []).forEach((l) => {
          const cid = String(l.colaborador_id || "");
          if (!conveniosPorUsuario.has(cid)) conveniosPorUsuario.set(cid, []);
          conveniosPorUsuario.get(cid)!.push(l);
        });
      }),
    ]);

    return {
      feriadosMes: new Set((feriadosRes.data || []).map((f) => f.data)),
      linksPorUsuario,
      ocorrenciasPorUsuario,
      fechamentosAnterioresMap,
      pontosPorUsuario,
      confirmacoesMap,
      conveniosPorUsuario,
    };
  },

  async upsertFechamento(
    usuarioId: string,
    mes: number,
    ano: number,
    payload: FechamentoPayload
  ) {
    const { data: existing } = await supabaseAdmin
      .from("fechamentos_financeiros")
      .select("id")
      .eq("colaborador_id", usuarioId)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    if (existing) {
      payload.id = existing.id;
    }

    const { data, error } = await supabaseAdmin
      .from("fechamentos_financeiros")
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async upsertConfirmacaoAdiantamento(
    usuarioId: string,
    mes: number,
    ano: number,
    payload: ConfirmacaoAdiantamentoPayload
  ): Promise<void> {
    const { data: existing } = await supabaseAdmin
      .from("confirmacoes_adiantamento")
      .select("id, lote_pagamento_id")
      .eq("colaborador_id", usuarioId)
      .eq("mes", mes)
      .eq("ano", ano)
      .maybeSingle();

    if (existing) {
      payload.id = existing.id;
      if (!payload.lote_pagamento_id && existing.lote_pagamento_id) {
        payload.lote_pagamento_id = existing.lote_pagamento_id;
      }
    }

    const { error } = await supabaseAdmin
      .from("confirmacoes_adiantamento")
      .upsert(payload)
      .select()
      .single();

    if (error) throw error;
  },

  async deleteConfirmacaoAdiantamento(usuarioId: string, mes: number, ano: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from("confirmacoes_adiantamento")
      .delete()
      .eq("colaborador_id", usuarioId)
      .eq("mes", mes)
      .eq("ano", ano);

    if (error) throw error;
  },

  async deleteFechamentoFinanceiro(usuarioId: string, mes: number, ano: number): Promise<void> {
    const { error } = await supabaseAdmin
      .from("fechamentos_financeiros")
      .delete()
      .eq("colaborador_id", usuarioId)
      .eq("mes", mes)
      .eq("ano", ano);

    if (error) throw error;
  },

  async carregarDadosStatusGeral(mes: number, ano: number, dataInicioMesStr: string) {
    const [confirmacoesRes, fechamentosRes, turnosRes] = await Promise.all([
      supabaseAdmin
        .from("confirmacoes_adiantamento")
        .select("*")
        .eq("mes", mes)
        .eq("ano", ano),
      supabaseAdmin
        .from("fechamentos_financeiros")
        .select("*")
        .eq("mes", mes)
        .eq("ano", ano),
      supabaseAdmin
        .from("colaborador_clientes")
        .select("colaborador_id, valor_adiantamento, data_inicio, data_fim, cliente:clientes(nome_fantasia)")
        .or(`data_fim.is.null,data_fim.gte.${dataInicioMesStr}`),
    ]);

    if (confirmacoesRes.error) throw confirmacoesRes.error;
    if (fechamentosRes.error) throw fechamentosRes.error;
    if (turnosRes.error) throw turnosRes.error;

    return {
      confirmacoes: (confirmacoesRes.data as ConfirmacaoAdiantamentoDb[]) || [],
      fechamentos: (fechamentosRes.data as FechamentoFinanceiroDb[]) || [],
      turnos: (turnosRes.data as ColaboradorClienteDb[]) || [],
    };
  },
};
