import { Ocorrencia } from "./database.js";

export interface ExtratoMensal {
    periodo: { mes: number; ano: number };
    status: string;
    adiantamento_confirmado: boolean;
    resumo_por_cliente: ResumoClienteFinanceiro[];
    mei_consolidado: MeiConsolidado;
    ocorrencias: Ocorrencia[];
    ocorrencias_avulsas: OcorrenciasAvulsas;
    totais: FinanceiroTotais;
    id_fechamento?: number;
    data_pagamento?: string;
}

export interface ResumoClienteFinanceiro {
    cliente_id: number;
    nome_fantasia?: string;
    id_vinculo: number;
    saldo_fixo_original: number;
    valores_fixos: {
        contrato: number;
        bonus: number;
        bonus_config: number;
        ajuda_custo: number;
        aluguel: number;
        adiantamento: number;
        adiantamento_config: number;
    };
    dias_base_mes: number;
    dias_ativos_no_mes: number;
    datas_ativas: string[];
    data_inicio: string | null;
    data_fim: string | null;
    creditos_ocorrencia: number;
    debitos_ocorrencia: number;
    valor_calculado: number;
}

export interface MeiConsolidado {
    valor_original: number;
    valor_calculado: number;
    dias_base: number;
    dias_ativos: number;
    datas_ativas: string[];
}

export interface OcorrenciasAvulsas {
    creditos: number;
    debitos: number;
    saldo: number;
}

export interface FinanceiroTotais {
    total_turnos: number;
    total_mei: number;
    total_avulso: number;
    total_adiantamento: number;
    saldo_final: number;
}

export interface FechamentoPayload {
    id?: number;
    colaborador_id: string;
    mes: number;
    ano: number;
    resumo_json: ExtratoMensal;
    saldo_final: number;
    fechado_por: string;
    data_fechamento: string;
    pago: boolean;
    data_pagamento: string;
}

export interface ConfirmacaoAdiantamentoPayload {
    id?: number;
    colaborador_id: string;
    mes: number;
    ano: number;
    confirmado_por: string;
    data_confirmacao: string;
}
