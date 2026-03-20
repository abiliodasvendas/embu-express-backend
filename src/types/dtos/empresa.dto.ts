import { Empresa } from "../../types/database.js";

export interface EmpresaDTO {
  id: number;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  ativo: boolean;
  codigo?: string | null;
}

export function toEmpresaDTO(empresa: Empresa): EmpresaDTO {
  return {
    id: empresa.id,
    nome_fantasia: empresa.nome_fantasia,
    razao_social: empresa.razao_social,
    cnpj: empresa.cnpj,
    ativo: empresa.ativo,
    codigo: empresa.codigo
  };
}

export function toEmpresaListDTO(empresas: Empresa[]): EmpresaDTO[] {
  return empresas.map(toEmpresaDTO);
}
