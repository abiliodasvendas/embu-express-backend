import { supabaseAdmin } from "../config/supabase.js";
import { extractDateOnly } from "../utils/utils.js";
import { Ocorrencia } from "../types/database.js";
import {
  ConfirmacaoComConta,
  FechamentoComConta,
  TurnoComEmpresa,
  unwrapSingle,
} from "../utils/folha-contas-pagar.helper.js";

export const folhaContasPagarRepository = {
  async listFechamentosPagosEFeriados(
    mesComp: number,
    anoComp: number,
    dataInicioMesStr: string,
    dataFimMesStr: string
  ): Promise<{
    fechamentosMap: Map<string, FechamentoComConta>;
    feriadosMes: Set<string>;
  }> {
    const [fechamentosRes, feriadosRes] = await Promise.all([
      supabaseAdmin
        .from("fechamentos_financeiros")
        .select(
          "id, colaborador_id, mes, ano, saldo_final, pago, data_pagamento, conta_bancaria_id, lote_pagamento_id, conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, empresa_id, empresa:empresas(id, nome_fantasia, razao_social))"
        )
        .eq("mes", mesComp)
        .eq("ano", anoComp)
        .eq("pago", true),
      supabaseAdmin
        .from("feriados")
        .select("data")
        .gte("data", dataInicioMesStr)
        .lte("data", dataFimMesStr),
    ]);

    const fechamentosMap = new Map<string, FechamentoComConta>();
    ((fechamentosRes.data || []) as unknown as FechamentoComConta[]).forEach((f) => {
      fechamentosMap.set(f.colaborador_id, f);
    });

    const feriadosMes = new Set((feriadosRes.data || []).map((f) => f.data));

    return { fechamentosMap, feriadosMes };
  },

  async carregarDadosSalariosEmLote(params: {
    colabIds: string[];
    mesComp: number;
    anoComp: number;
    dataInicioMesStr: string;
    dataFimMesStr: string;
    fechamentosMap: Map<string, FechamentoComConta>;
  }) {
    const { colabIds, mesComp, anoComp, dataInicioMesStr, dataFimMesStr, fechamentosMap } = params;

    let mesAnterior = mesComp - 1;
    let anoAnterior = anoComp;
    if (mesAnterior === 0) {
      mesAnterior = 12;
      anoAnterior = anoComp - 1;
    }

    const CHUNK_SIZE = 50;
    const chunks: string[][] = [];
    for (let i = 0; i < colabIds.length; i += CHUNK_SIZE) {
      chunks.push(colabIds.slice(i, i + CHUNK_SIZE));
    }

    const linksPorUsuario = new Map<string, TurnoComEmpresa[]>();
    const ocorrenciasPorUsuario = new Map<string, Ocorrencia[]>();
    const fechamentosAntMap = new Map<string, { saldo_final: number }>();
    const pontosPorUsuario = new Map<string, Array<Record<string, unknown>>>();
    const confirmacoesMap = new Map<string, Record<string, unknown>>();
    const conveniosPorUsuario = new Map<string, Array<Record<string, unknown>>>();

    await Promise.all(
      chunks.map(async (chunkIds) => {
        const pendentesChunkIds = chunkIds.filter((id) => !fechamentosMap.has(id));

        const linksPromise = supabaseAdmin
          .from("colaborador_clientes")
          .select(
            "*, empresa:empresas(id, nome_fantasia, razao_social), cliente:clientes(*), unidade:unidades_cliente(*), horarios:colaborador_cliente_horarios(*)"
          )
          .in("colaborador_id", chunkIds);

        if (pendentesChunkIds.length === 0) {
          const linksRes = await linksPromise;
          ((linksRes.data || []) as unknown as TurnoComEmpresa[]).forEach((l) => {
            if (!linksPorUsuario.has(l.colaborador_id)) linksPorUsuario.set(l.colaborador_id, []);
            linksPorUsuario.get(l.colaborador_id)!.push(l);
          });
          return;
        }

        const [
          linksRes,
          ocorrenciasRes,
          fechamentosAntRes,
          pontosRes,
          confirmacoesRes,
          conveniosRes,
        ] = await Promise.all([
          linksPromise,
          supabaseAdmin
            .from("ocorrencias")
            .select("*, tipo:tipos_ocorrencia(id, descricao)")
            .in("colaborador_id", pendentesChunkIds)
            .gte("data_ocorrencia", dataInicioMesStr)
            .lte("data_ocorrencia", dataFimMesStr),
          supabaseAdmin
            .from("fechamentos_financeiros")
            .select("colaborador_id, saldo_final")
            .in("colaborador_id", pendentesChunkIds)
            .eq("mes", mesAnterior)
            .eq("ano", anoAnterior)
            .eq("pago", true),
          supabaseAdmin
            .from("registros_ponto")
            .select("*")
            .in("usuario_id", pendentesChunkIds)
            .gte("data_referencia", dataInicioMesStr)
            .lte("data_referencia", dataFimMesStr),
          supabaseAdmin
            .from("confirmacoes_adiantamento")
            .select("*")
            .in("colaborador_id", pendentesChunkIds)
            .eq("mes", mesComp)
            .eq("ano", anoComp),
          supabaseAdmin
            .from("lancamentos_convenios")
            .select("*, convenio:convenios(nome)")
            .in("colaborador_id", pendentesChunkIds)
            .eq("moto_embu", false)
            .gte("data_lancamento", dataInicioMesStr)
            .lte("data_lancamento", dataFimMesStr),
        ]);

        ((linksRes.data || []) as unknown as TurnoComEmpresa[]).forEach((l) => {
          if (!linksPorUsuario.has(l.colaborador_id)) linksPorUsuario.set(l.colaborador_id, []);
          linksPorUsuario.get(l.colaborador_id)!.push(l);
        });

        ((ocorrenciasRes.data || []) as unknown as Ocorrencia[]).forEach((o) => {
          if (!ocorrenciasPorUsuario.has(o.colaborador_id)) ocorrenciasPorUsuario.set(o.colaborador_id, []);
          ocorrenciasPorUsuario.get(o.colaborador_id)!.push(o);
        });

        (fechamentosAntRes.data || []).forEach((f) => {
          fechamentosAntMap.set(f.colaborador_id, f);
        });

        (pontosRes.data || []).forEach((p) => {
          const uid = String(p.usuario_id || "");
          if (!pontosPorUsuario.has(uid)) pontosPorUsuario.set(uid, []);
          pontosPorUsuario.get(uid)!.push(p);
        });

        (confirmacoesRes.data || []).forEach((c) => {
          confirmacoesMap.set(c.colaborador_id, c);
        });

        (conveniosRes.data || []).forEach((l) => {
          const cid = String(l.colaborador_id || "");
          if (!conveniosPorUsuario.has(cid)) conveniosPorUsuario.set(cid, []);
          conveniosPorUsuario.get(cid)!.push(l);
        });
      })
    );

    return {
      linksPorUsuario,
      ocorrenciasPorUsuario,
      fechamentosAntMap,
      pontosPorUsuario,
      confirmacoesMap,
      conveniosPorUsuario,
    };
  },

  async carregarDadosValesCompetencia(
    mesComp: number,
    anoComp: number,
    dataInicioMesStr: string,
    dataFimMesStr: string
  ) {
    const [confirmacoesRes, turnosRes] = await Promise.all([
      supabaseAdmin
        .from("confirmacoes_adiantamento")
        .select(
          "id, colaborador_id, mes, ano, valor, data_confirmacao, data_pagamento, conta_bancaria_id, lote_pagamento_id, usuario:usuarios!confirmacoes_adiantamento_colaborador_id_fkey(id, nome_completo), conta_bancaria:contas_bancarias(id, banco_nome, agencia, conta, empresa_id, empresa:empresas(id, nome_fantasia, razao_social))"
        )
        .eq("mes", mesComp)
        .eq("ano", anoComp),
      supabaseAdmin
        .from("colaborador_clientes")
        .select(
          "id, colaborador_id, empresa_id, valor_adiantamento, data_inicio, data_fim, created_at, empresa:empresas(id, nome_fantasia, razao_social), usuario:usuarios!fk_colaborador_cliente_usuario(id, nome_completo)"
        )
        .or(`data_fim.is.null,data_fim.gte.${dataInicioMesStr}`),
    ]);

    const confirmacoes = (confirmacoesRes.data || []) as unknown as ConfirmacaoComConta[];
    const todosTurnos = ((turnosRes.data || []) as unknown as TurnoComEmpresa[]).filter((t) => {
      const dIni = extractDateOnly(t.data_inicio) || extractDateOnly(t.created_at);
      return !dIni || dIni <= dataFimMesStr;
    });

    const confirmacoesMap = new Map<string, ConfirmacaoComConta>();
    const nomesColaboradores = new Map<string, string>();

    confirmacoes.forEach((c) => {
      confirmacoesMap.set(c.colaborador_id, c);
      const u = unwrapSingle(c.usuario);
      if (u?.nome_completo) {
        nomesColaboradores.set(c.colaborador_id, u.nome_completo);
      }
    });

    const turnosPorColab = new Map<string, TurnoComEmpresa[]>();
    todosTurnos.forEach((t) => {
      if (!turnosPorColab.has(t.colaborador_id)) {
        turnosPorColab.set(t.colaborador_id, []);
      }
      turnosPorColab.get(t.colaborador_id)!.push(t);
      const u = unwrapSingle(t.usuario);
      if (u?.nome_completo) {
        nomesColaboradores.set(t.colaborador_id, u.nome_completo);
      }
    });

    const todosColabIds = new Set<string>([
      ...confirmacoesMap.keys(),
      ...turnosPorColab.keys(),
    ]);

    return {
      confirmacoesMap,
      turnosPorColab,
      nomesColaboradores,
      todosColabIds,
    };
  },
};
