import { Client } from "../../types/database.js";

export interface ClientDTO {
  id: number;
  public_id: string;
  nome_fantasia: string;
  ativo: boolean;
  unidades?: any[];
  created_at?: string;
}

export function toClientDTO(client: any): ClientDTO {
  return {
    id: client.id,
    public_id: client.public_id,
    nome_fantasia: client.nome_fantasia,
    ativo: client.ativo,
    unidades: client.unidades,
    created_at: client.created_at,
  };
}

export function toClientListDTO(clients: Client[]): ClientDTO[] {
  return clients.map(toClientDTO);
}
