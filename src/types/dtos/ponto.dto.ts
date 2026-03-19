import { Usuario, RegistroPonto, PontoLocation, DetalhesCalculo } from "../../types/database.js";

export interface PontoDTO {
  id: number;
  usuario_id: string;
  data: string;
  entrada?: string | null;
  saida?: string | null;
  pausa_inicio?: string | null;
  pausa_fim?: string | null;
  total_horas?: string | null;
  status: string;
  location?: PontoLocation | null;
  km?: number | null;
  cliente_id?: number | null;
  empresa_id?: number | null;
  detalhes_calculo?: DetalhesCalculo | null;
}

export function toPontoDTO(ponto: RegistroPonto): PontoDTO {
  return {
    id: ponto.id,
    usuario_id: ponto.usuario_id,
    data: ponto.data_referencia,
    entrada: ponto.entrada_hora,
    saida: ponto.saida_hora,
    pausa_inicio: ponto.pausas?.[0]?.inicio_hora,
    pausa_fim: ponto.pausas?.[0]?.fim_hora,
    total_horas: ponto.detalhes_calculo?.resumo?.total_trabalhado || ponto.detalhes_calculo?.resumo?.horas_trabalhadas,
    status: ponto.status_entrada,
    location: ponto.entrada_loc,
    km: ponto.entrada_km,
    cliente_id: ponto.cliente_id,
    empresa_id: ponto.empresa_id,
    detalhes_calculo: ponto.detalhes_calculo
  };
}

export function toPontoListDTO(pontos: RegistroPonto[]): PontoDTO[] {
  return pontos.map(toPontoDTO);
}
