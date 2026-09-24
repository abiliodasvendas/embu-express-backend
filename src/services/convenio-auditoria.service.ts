import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../errors/AppError.js";
import {
  AuditoriaConvenioResultado,
  FaturaFornecedorConvenio,
  LancamentoConvenio,
  StatusFaturaFornecedorConvenio,
  ConvenioResumoItem,
  ResumoGeralConveniosResultado,
} from "../types/database.js";
import { z } from "zod";
import { faturaFornecedorConvenioSchema } from "../schemas/convenio-auditoria.schema.js";

type FaturaFornecedorDTO = z.infer<typeof faturaFornecedorConvenioSchema>;

export const convenioAuditoriaService = {
  async getAuditoriaMensal(
    convenioId: string,
    mes: number,
    ano: number
  ): Promise<AuditoriaConvenioResultado> {
    const { data: convenio, error: convError } = await supabaseAdmin
      .from("convenios")
      .select("id, nome")
      .eq("id", convenioId)
      .single();

    if (convError || !convenio) {
      throw new AppError("Convênio não encontrado", 404);
    }

    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    const { data: fatura } = await supabaseAdmin
      .from("faturas_fornecedores_convenios")
      .select("*")
      .eq("convenio_id", convenioId)
      .eq("mes_competencia", mes)
      .eq("ano_competencia", ano)
      .maybeSingle();

    const { data: lancamentosRaw, error: lancError } = await supabaseAdmin
      .from("lancamentos_convenios")
      .select("*, colaborador:usuarios(id, nome_completo, cpf)")
      .eq("convenio_id", convenioId)
      .gte("data_lancamento", dataInicioMesStr)
      .lte("data_lancamento", dataFimMesStr)
      .order("data_lancamento", { ascending: false });

    if (lancError) throw lancError;

    const lancamentos = (lancamentosRaw || []) as LancamentoConvenio[];

    const DAVID_CAITITE_ID = "e7c2c19c-3b36-402a-9e73-9a3c3c3c3c3c";
    const isDavidOuMotoEmbu = (l: LancamentoConvenio) =>
      l.moto_embu ||
      l.colaborador_id === DAVID_CAITITE_ID ||
      Boolean(l.colaborador?.nome_completo && l.colaborador.nome_completo.toUpperCase().includes("DAVID CAITIT"));

    const lancamentosFrotaPropria = lancamentos.filter(isDavidOuMotoEmbu);
    const lancamentosMotoboys = lancamentos.filter((l) => !isDavidOuMotoEmbu(l) && l.colaborador_id);
    const lancamentosSemVinculo = lancamentos.filter((l) => !isDavidOuMotoEmbu(l) && !l.colaborador_id);

    const totalDescontadoMotoboys = parseFloat(
      lancamentosMotoboys.reduce((acc, l) => acc + Number(l.valor || 0), 0).toFixed(2)
    );
    const totalFrotaPropria = parseFloat(
      lancamentosFrotaPropria.reduce((acc, l) => acc + Number(l.valor || 0), 0).toFixed(2)
    );
    const totalSemVinculo = parseFloat(
      lancamentosSemVinculo.reduce((acc, l) => acc + Number(l.valor || 0), 0).toFixed(2)
    );
    const totalGeralLancamentos = parseFloat(
      (totalDescontadoMotoboys + totalFrotaPropria + totalSemVinculo).toFixed(2)
    );

    const totalFaturaFornecedor = fatura ? Number(fatura.valor_total_fatura) : 0;
    const saldoACargoEmbu = parseFloat(
      Math.max(0, totalFaturaFornecedor - totalDescontadoMotoboys).toFixed(2)
    );
    const diferencaNaoIdentificada = parseFloat(
      (saldoACargoEmbu - totalFrotaPropria).toFixed(2)
    );

    const temRiscoGlosa = totalFaturaFornecedor > 0 && diferencaNaoIdentificada > 0.05;
    const mensagemRisco = temRiscoGlosa
      ? `Cobrança Não Identificada / Risco de Glosa: O saldo a cargo da Embu (R$ ${saldoACargoEmbu.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) excede as despesas de frota própria (R$ ${totalFrotaPropria.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}) em R$ ${diferencaNaoIdentificada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Verifique as ordens de serviço antes de quitar o boleto.`
      : null;

    return {
      convenio_id: convenio.id,
      convenio_nome: convenio.nome,
      mes_competencia: mes,
      ano_competencia: ano,
      fatura_fornecedor: fatura as FaturaFornecedorConvenio | null,
      total_fatura_fornecedor: totalFaturaFornecedor,
      total_descontado_motoboys: totalDescontadoMotoboys,
      total_frota_propria: totalFrotaPropria,
      total_sem_vinculo: totalSemVinculo,
      total_geral_lancamentos: totalGeralLancamentos,
      saldo_a_cargo_embu: saldoACargoEmbu,
      diferenca_nao_identificada: diferencaNaoIdentificada,
      tem_risco_glosa: temRiscoGlosa,
      mensagem_risco: mensagemRisco,
      lancamentos_motoboys: lancamentosMotoboys,
      lancamentos_frota_propria: lancamentosFrotaPropria,
      lancamentos_sem_vinculo: lancamentosSemVinculo,
    };
  },

  async salvarFaturaFornecedor(
    payload: FaturaFornecedorDTO,
    criadoPor?: string
  ): Promise<FaturaFornecedorConvenio> {
    const { data: existente } = await supabaseAdmin
      .from("faturas_fornecedores_convenios")
      .select("id")
      .eq("convenio_id", payload.convenio_id)
      .eq("mes_competencia", payload.mes_competencia)
      .eq("ano_competencia", payload.ano_competencia)
      .maybeSingle();

    if (existente) {
      const { data, error } = await supabaseAdmin
        .from("faturas_fornecedores_convenios")
        .update({
          valor_total_fatura: payload.valor_total_fatura,
          data_vencimento: payload.data_vencimento,
          status: payload.status,
          comprovante_url: payload.comprovante_url || null,
          observacoes: payload.observacoes || null,
        })
        .eq("id", existente.id)
        .select()
        .single();

      if (error) throw error;
      return data as FaturaFornecedorConvenio;
    }

    const { data, error } = await supabaseAdmin
      .from("faturas_fornecedores_convenios")
      .insert([
        {
          ...payload,
          criado_por: criadoPor || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data as FaturaFornecedorConvenio;
  },

  async atualizarStatusFatura(
    id: string,
    status: StatusFaturaFornecedorConvenio,
    observacoes?: string | null
  ): Promise<FaturaFornecedorConvenio> {
    const updateData: { status: StatusFaturaFornecedorConvenio; observacoes?: string | null } = { status };
    if (observacoes !== undefined) updateData.observacoes = observacoes;

    const { data, error } = await supabaseAdmin
      .from("faturas_fornecedores_convenios")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data as FaturaFornecedorConvenio;
  },

  async getResumoGeralConvenios(mes: number, ano: number): Promise<ResumoGeralConveniosResultado> {
    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    const [conveniosRes, faturasRes, lancamentosRes] = await Promise.all([
      supabaseAdmin
        .from("convenios")
        .select("id, nome, ativo")
        .order("nome", { ascending: true }),
      supabaseAdmin
        .from("faturas_fornecedores_convenios")
        .select("*")
        .eq("mes_competencia", mes)
        .eq("ano_competencia", ano),
      supabaseAdmin
        .from("lancamentos_convenios")
        .select("id, convenio_id, valor, moto_embu, colaborador_id, colaborador:usuarios(id, nome_completo)")
        .gte("data_lancamento", dataInicioMesStr)
        .lte("data_lancamento", dataFimMesStr)
    ]);

    if (conveniosRes.error) throw conveniosRes.error;

    const convenios = conveniosRes.data || [];
    const faturas = faturasRes.data || [];
    const lancamentos = lancamentosRes.data || [];

    const faturasMap = new Map<string, FaturaFornecedorConvenio>();
    faturas.forEach(f => faturasMap.set(f.convenio_id, f as FaturaFornecedorConvenio));

    type LancamentoWithColab = {
      id: string;
      convenio_id: string;
      valor: number;
      moto_embu: boolean;
      colaborador_id: string | null;
      colaborador?: { id: string; nome_completo: string | null } | null;
    };

    const lancamentosPorConvenio = new Map<string, LancamentoWithColab[]>();
    (lancamentos as unknown as LancamentoWithColab[]).forEach(l => {
      if (!lancamentosPorConvenio.has(l.convenio_id)) lancamentosPorConvenio.set(l.convenio_id, []);
      lancamentosPorConvenio.get(l.convenio_id)!.push(l);
    });

    const DAVID_CAITITE_ID = "e7c2c19c-3b36-402a-9e73-9a3c3c3c3c3c";
    const isDavidOuMotoEmbu = (l: LancamentoWithColab) =>
      l.moto_embu ||
      l.colaborador_id === DAVID_CAITITE_ID ||
      Boolean(l.colaborador?.nome_completo && l.colaborador.nome_completo.toUpperCase().includes("DAVID CAITIT"));

    let globalConsumido = 0;
    let globalMotoboys = 0;
    let globalMotoEmbuDavid = 0;
    let globalSemVinculo = 0;
    let globalFaturas = 0;

    const conveniosNomeMap = new Map<string, string>();
    convenios.forEach(c => conveniosNomeMap.set(c.id, c.nome));

    const colaboradoresMap = new Map<string, {
      colaborador_id: string;
      nome_completo: string;
      total_gasto: number;
      quantidade_lancamentos: number;
      convenios_utilizados: Set<string>;
    }>();

    (lancamentos as unknown as LancamentoWithColab[]).forEach(l => {
      if (l.colaborador_id && !isDavidOuMotoEmbu(l)) {
        const cId = l.colaborador_id;
        const nome = l.colaborador?.nome_completo || "Colaborador";
        const convNome = conveniosNomeMap.get(l.convenio_id) || "Convênio";

        if (!colaboradoresMap.has(cId)) {
          colaboradoresMap.set(cId, {
            colaborador_id: cId,
            nome_completo: nome,
            total_gasto: 0,
            quantidade_lancamentos: 0,
            convenios_utilizados: new Set<string>()
          });
        }

        const cData = colaboradoresMap.get(cId)!;
        cData.total_gasto += Number(l.valor || 0);
        cData.quantidade_lancamentos += 1;
        cData.convenios_utilizados.add(convNome);
      }
    });

    const topColaboradores = Array.from(colaboradoresMap.values())
      .map(c => ({
        colaborador_id: c.colaborador_id,
        nome_completo: c.nome_completo,
        total_gasto: parseFloat(c.total_gasto.toFixed(2)),
        quantidade_lancamentos: c.quantidade_lancamentos,
        convenios_utilizados: Array.from(c.convenios_utilizados)
      }))
      .sort((a, b) => b.total_gasto - a.total_gasto)
      .slice(0, 10);

    const conveniosItens: ConvenioResumoItem[] = convenios.map(conv => {
      const convLancamentos = lancamentosPorConvenio.get(conv.id) || [];
      const fatura = faturasMap.get(conv.id);

      let totalConsumido = 0;
      let totalMotoboys = 0;
      let totalMotoEmbuDavid = 0;
      let totalSemVinculo = 0;
      const distinctColabs = new Set<string>();

      convLancamentos.forEach(l => {
        const v = Number(l.valor || 0);
        totalConsumido += v;
        if (isDavidOuMotoEmbu(l)) {
          totalMotoEmbuDavid += v;
        } else if (l.colaborador_id) {
          totalMotoboys += v;
          distinctColabs.add(l.colaborador_id);
        } else {
          totalSemVinculo += v;
        }
      });

      globalConsumido += totalConsumido;
      globalMotoboys += totalMotoboys;
      globalMotoEmbuDavid += totalMotoEmbuDavid;
      globalSemVinculo += totalSemVinculo;

      let faturaItem: ConvenioResumoItem["fatura_fornecedor"] = null;
      if (fatura) {
        const faturaValor = Number(fatura.valor_total_fatura || 0);
        globalFaturas += faturaValor;
        faturaItem = {
          id: fatura.id,
          valor_total_fatura: faturaValor,
          data_vencimento: fatura.data_vencimento,
          status: fatura.status as StatusFaturaFornecedorConvenio,
          saldo_embu: parseFloat((faturaValor - totalMotoboys).toFixed(2))
        };
      }

      const ticketMedio = convLancamentos.length > 0 ? parseFloat((totalConsumido / convLancamentos.length).toFixed(2)) : 0;

      return {
        id: conv.id,
        nome: conv.nome,
        ativo: conv.ativo,
        total_consumido: parseFloat(totalConsumido.toFixed(2)),
        total_motoboys: parseFloat(totalMotoboys.toFixed(2)),
        total_moto_embu_david: parseFloat(totalMotoEmbuDavid.toFixed(2)),
        total_sem_vinculo: parseFloat(totalSemVinculo.toFixed(2)),
        quantidade_lancamentos: convLancamentos.length,
        total_colaboradores_distintos: distinctColabs.size,
        ticket_medio: ticketMedio,
        fatura_fornecedor: faturaItem
      };
    });

    const totalSaldoEmbu = parseFloat((globalFaturas - globalMotoboys).toFixed(2));

    const distribuicaoPercentual = conveniosItens
      .filter(c => c.total_consumido > 0)
      .map(c => ({
        convenio_id: c.id,
        nome: c.nome,
        percentual: globalConsumido > 0 ? parseFloat(((c.total_consumido / globalConsumido) * 100).toFixed(1)) : 0,
        total: c.total_consumido
      }))
      .sort((a, b) => b.total - a.total);

    return {
      periodo: { mes, ano },
      totais: {
        total_geral_consumido: parseFloat(globalConsumido.toFixed(2)),
        total_motoboys: parseFloat(globalMotoboys.toFixed(2)),
        total_moto_embu_david: parseFloat(globalMotoEmbuDavid.toFixed(2)),
        total_sem_vinculo: parseFloat(globalSemVinculo.toFixed(2)),
        total_faturas_fornecedores: parseFloat(globalFaturas.toFixed(2)),
        total_saldo_cargo_embu: totalSaldoEmbu
      },
      convenios: conveniosItens,
      top_colaboradores: topColaboradores,
      distribuicao_percentual: distribuicaoPercentual
    };
  },
};
