import { Client } from "../../types/database.js";

export interface ClientDTO {
  id: number;
  public_id: string;
  nome_fantasia: string;
  ativo: boolean;
  tipo_cobranca?: string;
  valor_base?: number;
  valor_diaria_glosa?: number;
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
    valor_base: client.valor_base,
    valor_diaria_glosa: client.valor_diaria_glosa,
    empresa_emissora_padrao_id: client.empresa_emissora_padrao_id,
    empresa_emissora_padrao: client.empresa_emissora_padrao,
    unidades: client.unidades,
    created_at: client.created_at,
  };
}

export function toClientListDTO(clients: Client[]): ClientDTO[] {
  return clients.map(toClientDTO);
}
