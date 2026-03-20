import { Unidade } from "../database.js";

export interface UnidadeDTO {
  id: number;
  cliente_id: number;
  nome_unidade: string;
  razao_social: string;
  cnpj: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  km_contratados?: number | null;
  escala_semanal?: number[] | null;
  ativo: boolean;
  cliente_nome?: string;
  created_at: string;
}

export function toUnidadeDTO(u: any): UnidadeDTO {
  return {
    id: u.id,
    cliente_id: u.cliente_id,
    nome_unidade: u.nome_unidade,
    razao_social: u.razao_social,
    cnpj: u.cnpj,
    cep: u.cep,
    logradouro: u.logradouro,
    numero: u.numero,
    complemento: u.complemento,
    bairro: u.bairro,
    cidade: u.cidade,
    estado: u.estado,
    km_contratados: u.km_contratados,
    escala_semanal: u.escala_semanal,
    ativo: u.ativo,
    cliente_nome: u.cliente?.nome_fantasia,
    created_at: u.created_at
  };
}

export function toUnidadeListDTO(unidades: Unidade[]): UnidadeDTO[] {
  return (unidades || []).map(toUnidadeDTO);
}
