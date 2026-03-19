export interface TipoOcorrenciaDTO {
  id: number;
  descricao: string;
  impacto_financeiro: boolean;
  valor_padrao?: number | null;
}

export interface OcorrenciaDTO {
  id: number;
  colaborador_id: string;
  colaborador_cliente_id?: number | null;
  tipo_id: number;
  data_ocorrencia: string;
  valor?: number | null;
  impacto_financeiro: boolean;
  tipo_lancamento: 'ENTRADA' | 'SAIDA';
  observacao?: string | null;
  created_at: string;
  tipo?: {
    id: number;
    descricao: string;
  };
  colaborador?: {
    id: string;
    nome_completo: string;
  };
}

export function toTipoOcorrenciaDTO(tipo: any): TipoOcorrenciaDTO {
  return {
    id: tipo.id,
    descricao: tipo.descricao,
    impacto_financeiro: !!tipo.impacto_financeiro,
    valor_padrao: tipo.valor_padrao
  };
}

export function toTipoOcorrenciaListDTO(tipos: any[]): TipoOcorrenciaDTO[] {
  return tipos.map(toTipoOcorrenciaDTO);
}

export function toOcorrenciaDTO(o: any): OcorrenciaDTO {
  return {
    id: o.id,
    colaborador_id: o.colaborador_id,
    colaborador_cliente_id: o.colaborador_cliente_id,
    tipo_id: o.tipo_id,
    data_ocorrencia: o.data_ocorrencia,
    valor: o.valor,
    impacto_financeiro: !!o.impacto_financeiro,
    tipo_lancamento: o.tipo_lancamento,
    observacao: o.observacao,
    created_at: o.created_at,
    tipo: o.tipo,
    colaborador: o.colaborador
  };
}

export function toOcorrenciaListDTO(ocorrencias: any[]): OcorrenciaDTO[] {
  return ocorrencias.map(toOcorrenciaDTO);
}
