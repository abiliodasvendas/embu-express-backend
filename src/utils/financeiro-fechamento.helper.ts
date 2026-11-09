import { supabaseAdmin } from "../config/supabase.js";
import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";
import { ROLES } from "../constants/permissions.enum.js";
import { ExtratoMensal } from "../types/financeiro.type.js";

export interface ColaboradorElegivelMes {
    id: string;
    nome_completo: string;
    email: string;
    status: string | null;
    valor_mei: number | null;
}

export interface ComponentesFolhaColaborador {
    bruto: number;
    faltas: number;
    convenios: number;
    adiantamentoPago: number;
}

export async function obterPerfilMotoboyId(): Promise<number> {
    const { data: perfilMotoboy } = await supabaseAdmin
        .from("perfis")
        .select("id")
        .ilike("nome", ROLES.MOTOBOY)
        .maybeSingle();

    return perfilMotoboy?.id || 3;
}

export async function obterColaboradoresElegiveisMes(params: {
    mes: number;
    ano: number;
    dataInicioMesStr: string;
    dataFimMesStr: string;
}): Promise<ColaboradorElegivelMes[]> {
    const { mes, ano, dataInicioMesStr, dataFimMesStr } = params;
    const perfilMotoboyId = await obterPerfilMotoboyId();

    const { data: todosMotoboys, error: colabError } = await supabaseAdmin
        .from("usuarios")
        .select("id, nome_completo, email, status, valor_mei")
        .in("status", [CADASTRO_STATUS.ATIVO, CADASTRO_STATUS.INATIVO])
        .eq("perfil_id", perfilMotoboyId)
        .order("nome_completo", { ascending: true });

    if (colabError) throw colabError;
    if (!todosMotoboys || todosMotoboys.length === 0) return [];

    const inativos = todosMotoboys.filter(u => u.status === CADASTRO_STATUS.INATIVO);
    if (inativos.length === 0) {
        return todosMotoboys;
    }

    const inativosIds = inativos.map(u => u.id);
    const idsInativosComAtividade = new Set<string>();

    const CHUNK_SIZE = 50;
    const chunks: string[][] = [];
    for (let i = 0; i < inativosIds.length; i += CHUNK_SIZE) {
        chunks.push(inativosIds.slice(i, i + CHUNK_SIZE));
    }

    await Promise.all(
        chunks.map(async (chunkIds) => {
            const [
                turnosRes,
                fechamentosRes,
                confirmacoesRes,
                pontosRes,
                ocorrenciasRes,
                conveniosRes
            ] = await Promise.all([
                supabaseAdmin
                    .from("colaborador_clientes")
                    .select("colaborador_id, data_inicio, data_fim")
                    .in("colaborador_id", chunkIds)
                    .or(`data_fim.is.null,data_fim.gte.${dataInicioMesStr}`),
                supabaseAdmin
                    .from("fechamentos_financeiros")
                    .select("colaborador_id")
                    .in("colaborador_id", chunkIds)
                    .eq("mes", mes)
                    .eq("ano", ano),
                supabaseAdmin
                    .from("confirmacoes_adiantamento")
                    .select("colaborador_id")
                    .in("colaborador_id", chunkIds)
                    .eq("mes", mes)
                    .eq("ano", ano),
                supabaseAdmin
                    .from("registros_ponto")
                    .select("usuario_id")
                    .in("usuario_id", chunkIds)
                    .gte("data_referencia", dataInicioMesStr)
                    .lte("data_referencia", dataFimMesStr),
                supabaseAdmin
                    .from("ocorrencias")
                    .select("colaborador_id")
                    .in("colaborador_id", chunkIds)
                    .gte("data_ocorrencia", dataInicioMesStr)
                    .lte("data_ocorrencia", dataFimMesStr),
                supabaseAdmin
                    .from("lancamentos_convenios")
                    .select("colaborador_id")
                    .in("colaborador_id", chunkIds)
                    .eq("moto_embu", false)
                    .gte("data_lancamento", dataInicioMesStr)
                    .lte("data_lancamento", dataFimMesStr)
            ]);

            (turnosRes.data || []).forEach(t => {
                const inicioValido = !t.data_inicio || t.data_inicio <= dataFimMesStr;
                const fimValido = !t.data_fim || t.data_fim >= dataInicioMesStr;
                if (inicioValido && fimValido) {
                    idsInativosComAtividade.add(t.colaborador_id);
                }
            });

            (fechamentosRes.data || []).forEach(f => idsInativosComAtividade.add(f.colaborador_id));
            (confirmacoesRes.data || []).forEach(c => idsInativosComAtividade.add(c.colaborador_id));
            (pontosRes.data || []).forEach(p => idsInativosComAtividade.add(p.usuario_id));
            (ocorrenciasRes.data || []).forEach(o => idsInativosComAtividade.add(o.colaborador_id));
            (conveniosRes.data || []).forEach(l => {
                if (l.colaborador_id) idsInativosComAtividade.add(l.colaborador_id);
            });
        })
    );

    return todosMotoboys.filter(
        u => u.status === CADASTRO_STATUS.ATIVO || idsInativosComAtividade.has(u.id)
    );
}

export function extrairComponentesFolha(r: Partial<ExtratoMensal>): ComponentesFolhaColaborador {
    let colabBruto = 0;
    let colabFaltas = 0;
    let colabAdi = 0;

    (r.resumo_por_cliente || []).forEach((c) => {
        const v = c.valores_fixos;
        const baseBrutaFixa = Number(v?.contrato || 0) + Number(v?.ajuda_custo || 0) + Number(v?.aluguel || 0);
        const diasBase = Number(c.dias_base_mes) || 26;
        const diasEsperados = Number(c.dias_esperados_turno) || diasBase;
        const brutoVigente = (baseBrutaFixa / diasBase) * diasEsperados;
        colabBruto += brutoVigente + Number(v?.bonus || 0) + Number(c.creditos_ocorrencia || 0);

        const adi = Number(v?.adiantamento || 0);
        colabAdi += adi;
        const ausencias = Math.max(0, Number(c.debitos_ocorrencia || 0) - adi);
        colabFaltas += ausencias;
    });

    const mei = Number(r.mei_consolidado?.valor_calculado || 0);
    const credAvulso = Number(r.ocorrencias_avulsas?.creditos || 0);
    const debAvulso = Number(r.ocorrencias_avulsas?.debitos || 0);
    const conv = (r.lancamentos_convenios || []).reduce((acc, l) => acc + Number(l.valor || 0), 0);

    return {
        bruto: colabBruto + mei + credAvulso,
        faltas: colabFaltas + debAvulso,
        convenios: conv,
        adiantamentoPago: colabAdi
    };
}
