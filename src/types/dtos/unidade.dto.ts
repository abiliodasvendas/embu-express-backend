import { Unidade, Empresa } from "../database.js";

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
  valor_contrato_mensal: number;
  periodicidade: string;
  dia_vencimento_padrao: number;
  empresa_emissora_padrao_id?: number | null;
  conta_bancaria_padrao_id?: string | null;
  tipo_cobranca?: string;
  empresa_emissora_padrao?: Empresa | null;
  cliente_nome?: string;
  created_at?: string;
}

export function toUnidadeDTO(u: Unidade & { cliente?: { nome_fantasia?: string }; empresa_emissora_padrao?: Empresa }): UnidadeDTO {
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
    valor_contrato_mensal: Number(u.valor_contrato_mensal || 0),
    periodicidade: u.periodicidade || "QUINZENAL",
    dia_vencimento_padrao: u.dia_vencimento_padrao || 16,
    empresa_emissora_padrao_id: u.empresa_emissora_padrao_id,
    conta_bancaria_padrao_id: u.conta_bancaria_padrao_id,
    tipo_cobranca: u.tipo_cobranca || "FIXO_MENSAL",
    empresa_emissora_padrao: u.empresa_emissora_padrao,
    cliente_nome: u.cliente?.nome_fantasia,
    created_at: u.created_at,
  };
}

export function toUnidadeListDTO(unidades: Array<Unidade & { cliente?: { nome_fantasia?: string }; empresa_emissora_padrao?: Empresa }>): UnidadeDTO[] {
  return (unidades || []).map(toUnidadeDTO);
}
