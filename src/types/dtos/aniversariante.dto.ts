import { UsuarioDTO } from "./usuario.dto.js";

export interface AniversarianteItemDTO {
    id: string;
    nome_completo: string;
    data_nascimento: string;
    dia: number;
    mes: number;
    eh_hoje: boolean;
    perfil_nome: string | null;
}

export interface AniversariantesResumoDTO {
    total_hoje: number;
    total_mes: number;
    total_sem_data: number;
}

export interface AniversariantesResponseDTO {
    mes_referencia: number;
    dia_atual: number;
    mes_atual: number;
    hoje: AniversarianteItemDTO[];
    aniversariantes_mes: AniversarianteItemDTO[];
    sem_data_nascimento: UsuarioDTO[];
    resumo: AniversariantesResumoDTO;
}
