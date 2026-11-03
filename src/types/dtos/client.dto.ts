import { Client } from "../../types/database.js";

export interface ClientDTO {
  id: number;
  public_id: string;
  nome_fantasia: string;
  ativo: boolean;
  valor_total_contrato?: number;
  unidades?: unknown[];
  created_at?: string;
}

export function toClientDTO(client: Client & { unidades?: unknown[]; valor_total_contrato?: number }): ClientDTO {
  return {
    id: client.id,
    public_id: client.public_id,
    nome_fantasia: client.nome_fantasia,
    ativo: client.ativo,
    valor_total_contrato: client.valor_total_contrato != null ? Number(client.valor_total_contrato) : undefined,
    unidades: client.unidades,
    created_at: client.created_at,
  };
}

export function toClientListDTO(clients: Array<Client & { valor_total_contrato?: number }>): ClientDTO[] {
  return clients.map(toClientDTO);
}
