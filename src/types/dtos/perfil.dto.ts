import { Permissao } from "../database.js";

export interface PerfilDTO {
    id: number;
    nome: string;
    descricao?: string;
    permissoes?: string[];
    detalhes_permissoes?: Permissao[];
    total_colaboradores?: number;
}

export function toPerfilDTO(perfil: any): PerfilDTO {
    if (!perfil) return perfil;

    // Extrair apenas os nomes das permissões para o array 'permissoes'
    const permissoesArray = perfil.perfil_permissoes?.map((pp: any) => pp.permissao?.nome_interno).filter(Boolean) || [];
    
    // Extrair objetos completos de permissões para 'detalhes_permissoes'
    const detalhesPermissoes = perfil.perfil_permissoes?.map((pp: any) => pp.permissao).filter(Boolean) || [];

    return {
        id: perfil.id,
        nome: perfil.nome,
        descricao: perfil.descricao,
        total_colaboradores: perfil.total_colaboradores,
        permissoes: permissoesArray,
        detalhes_permissoes: detalhesPermissoes
    };
}

export function toPerfilListDTO(perfis: any[]): PerfilDTO[] {
    return perfis.map(toPerfilDTO);
}
