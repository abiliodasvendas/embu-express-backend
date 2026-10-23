import { Client } from "../../types/database.js";

export interface ClientDTO {
  id: number;
  public_id: string;
  nome_fantasia: string;
  ativo: boolean;
  tipo_cobranca?: string;
  periodicidade?: string;
  dia_vencimento_padrao?: number;
  valor_base?: number;
  valor_contrato_mensal?: number;
  empresa_emissora_padrao_id?: number | null;
  empresa_emissora_padrao?: any;
  unidades?: any[];
  created_at?: string;
}

export function toClientDTO(client: any): ClientDTO {
  return {
    id: client.id,
    public_id: client.public_id,
    nome_fantasia: client.nome_fantasia,
    ativo: client.ativo,
    tipo_cobranca: client.tipo_cobranca,
    periodicidade: client.periodicidade,
    dia_vencimento_padrao: client.dia_vencimento_padrao,
    valor_base: client.valor_base != null ? Number(client.valor_base) : undefined,
    valor_contrato_mensal: client.valor_contrato_mensal != null ? Number(client.valor_contrato_mensal) : (client.valor_base != null ? Number(client.valor_base) : undefined),
    empresa_emissora_padrao_id: client.empresa_emissora_padrao_id,
    empresa_emissora_padrao: client.empresa_emissora_padrao,
    unidades: client.unidades,
    created_at: client.created_at,
  };
}

export function toClientListDTO(clients: Client[]): ClientDTO[] {
  return clients.map(toClientDTO);
}
