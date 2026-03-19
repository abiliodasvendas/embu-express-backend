import { Usuario } from "../../types/database.js";

export interface UsuarioDTO {
  id: string;
  email: string;
  nome_completo: string;
  cpf?: string;
  perfil_id?: number;
  perfil?: any;
  empresa_id?: number;
  status: string;
  created_at: string;
  links?: any[];
  [key: string]: any; // Permitir campos dinâmicos
}

export function toUsuarioDTO(usuario: any): UsuarioDTO {
  return {
    ...usuario,
    created_at: usuario.created_at || new Date().toISOString(),
  };
}

export function toUsuarioListDTO(usuarios: Usuario[]): UsuarioDTO[] {
  return usuarios.map(toUsuarioDTO);
}
