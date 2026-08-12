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

export interface PaginatedUsuariosDTO {
  data: UsuarioDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

export function toPaginatedUsuarioListDTO(result: {
  data: Usuario[];
  total: number;
  page: number;
  pageSize: number;
}): PaginatedUsuariosDTO {
  return {
    data: toUsuarioListDTO(result.data),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: Math.ceil(result.total / result.pageSize) || 1,
  };
}
