import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";
import { supabaseAdmin } from "../config/supabase.js";
import { Tables } from "../types/database.types.js";
import {
    AniversarianteItemDTO,
    AniversariantesResponseDTO,
} from "../types/dtos/aniversariante.dto.js";
import { toUsuarioDTO, UsuarioDTO } from "../types/dtos/usuario.dto.js";

type UsuarioComPerfilRow = Tables<"usuarios"> & {
    perfil: { id: number; nome: string } | null;
};

const SAO_PAULO_TIMEZONE = "America/Sao_Paulo";

function getDataAtualSaoPaulo(): { dia: number; mes: number } {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: SAO_PAULO_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
    const parts = formatter.formatToParts(new Date());
    const dayPart = parts.find((p) => p.type === "day")?.value ?? "1";
    const monthPart = parts.find((p) => p.type === "month")?.value ?? "1";
    return {
        dia: Number(dayPart),
        mes: Number(monthPart),
    };
}

function extrairDiaMes(dataIso: string): { dia: number; mes: number } | null {
    const cleanDate = dataIso.trim().slice(0, 10);
    const segments = cleanDate.split("-");
    if (segments.length !== 3) return null;

    const mes = Number(segments[1]);
    const dia = Number(segments[2]);
    if (!Number.isInteger(mes) || !Number.isInteger(dia)) return null;
    if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

    return { dia, mes };
}

export const aniversarianteService = {
    async listarAniversariantes(mesSolicitado?: number): Promise<AniversariantesResponseDTO> {
        const { dia: diaAtual, mes: mesAtual } = getDataAtualSaoPaulo();
        const mesReferencia = mesSolicitado ?? mesAtual;

        const { data, error } = await supabaseAdmin
            .from("usuarios")
            .select("*, perfil:perfis(id, nome)")
            .eq("status", CADASTRO_STATUS.ATIVO)
            .order("nome_completo", { ascending: true });

        if (error) throw error;

        const usuariosAtivos = (data ?? []) as unknown as UsuarioComPerfilRow[];
        const hoje: AniversarianteItemDTO[] = [];
        const aniversariantesMes: AniversarianteItemDTO[] = [];
        const semDataNascimento: UsuarioDTO[] = [];

        for (const usuario of usuariosAtivos) {
            if (!usuario.data_nascimento) {
                semDataNascimento.push(toUsuarioDTO(usuario));
                continue;
            }

            const parsed = extrairDiaMes(usuario.data_nascimento);
            if (!parsed) {
                semDataNascimento.push(toUsuarioDTO(usuario));
                continue;
            }

            const ehHoje = parsed.dia === diaAtual && parsed.mes === mesAtual;
            const item: AniversarianteItemDTO = {
                id: usuario.id,
                nome_completo: usuario.nome_completo,
                data_nascimento: usuario.data_nascimento,
                dia: parsed.dia,
                mes: parsed.mes,
                eh_hoje: ehHoje,
                perfil_nome: usuario.perfil?.nome ?? null,
            };

            if (ehHoje) {
                hoje.push(item);
            }

            if (parsed.mes === mesReferencia) {
                aniversariantesMes.push(item);
            }
        }

        hoje.sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));
        aniversariantesMes.sort((a, b) => {
            if (a.dia !== b.dia) return a.dia - b.dia;
            return a.nome_completo.localeCompare(b.nome_completo, "pt-BR");
        });

        return {
            mes_referencia: mesReferencia,
            dia_atual: diaAtual,
            mes_atual: mesAtual,
            hoje,
            aniversariantes_mes: aniversariantesMes,
            sem_data_nascimento: semDataNascimento,
            resumo: {
                total_hoje: hoje.length,
                total_mes: aniversariantesMes.length,
                total_sem_data: semDataNascimento.length,
            },
        };
    },
};
