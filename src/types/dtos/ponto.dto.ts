import { Usuario, RegistroPonto, PontoLocation, DetalhesCalculo, Pausa } from "../../types/database.js";

export interface PontoDTO {
  id: number;
  usuario_id: string;
  data_referencia: string;
  entrada_hora?: string | null;
  saida_hora?: string | null;
  entrada_km?: number | null;
  saida_km?: number | null;
  total_horas?: string | null;
  status_entrada: string;
  status_saida?: string;
  saldo_minutos?: number | null;
  location?: PontoLocation | null;
  cliente_id?: number | null;
  empresa_id?: number | null;
  detalhes_calculo?: DetalhesCalculo | null;
  pausas?: Pausa[] | null;
  usuario?: Usuario | null;
  cliente?: any | null;
  colaborador_cliente?: any | null;
  observacao?: string | null;
}

export function toPontoDTO(ponto: any): PontoDTO {
  return {
    id: ponto.id,
    usuario_id: ponto.usuario_id,
    data_referencia: ponto.data_referencia,
    entrada_hora: ponto.entrada_hora,
    saida_hora: ponto.saida_hora,
    entrada_km: ponto.entrada_km,
    saida_km: ponto.saida_km,
    total_horas: ponto.detalhes_calculo?.resumo?.total_trabalhado || ponto.detalhes_calculo?.resumo?.horas_trabalhadas,
    status_entrada: ponto.status_entrada,
    status_saida: ponto.status_saida,
    saldo_minutos: ponto.saldo_minutos,
    location: ponto.entrada_loc,
    cliente_id: ponto.cliente_id,
    empresa_id: ponto.empresa_id,
    detalhes_calculo: ponto.detalhes_calculo,
    pausas: ponto.pausas || [],
    usuario: ponto.usuario,
    cliente: ponto.cliente,
    colaborador_cliente: ponto.colaborador_cliente,
    observacao: ponto.observacao
  };
}

export function toPontoListDTO(pontos: RegistroPonto[]): PontoDTO[] {
  return pontos.map(toPontoDTO);
}
