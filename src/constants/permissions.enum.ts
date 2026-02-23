export const PERMISSIONS = {
    USUARIOS: {
        VER: 'usuarios:ver',
        CRIAR: 'usuarios:criar',
        EDITAR: 'usuarios:editar',
        DELETAR: 'usuarios:deletar',
        STATUS: 'usuarios:status',
    },
    PERFIS: {
        VER: 'perfis:ver',
        CRIAR: 'perfis:criar',
        EDITAR: 'perfis:editar',
        DELETAR: 'perfis:deletar',
    },
    CLIENTES: {
        VER: 'clientes:ver',
        CRIAR: 'clientes:criar',
        EDITAR: 'clientes:editar',
        DELETAR: 'clientes:deletar',
        STATUS: 'clientes:status',
    },
    EMPRESAS: {
        VER: 'empresas:ver',
        CRIAR: 'empresas:criar',
        EDITAR: 'empresas:editar',
        DELETAR: 'empresas:deletar',
        STATUS: 'empresas:status',
    },
    PONTO: {
        REGISTRAR: 'ponto:registrar', // Operacional (Motoboy bate ponto)
        ADMIN_VER: 'ponto:admin_ver', // Painel: Ver lista de todos
        ADMIN_CRIAR: 'ponto:admin_criar', // Painel: Inserir ponto manualmente
        ADMIN_EDITAR: 'ponto:admin_editar', // Painel: Corrigir linha
        ADMIN_DELETAR: 'ponto:admin_deletar', // Painel: Excluir linha
    },
} as const;

export const ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MOTOBOY: 'motoboy',
    CLIENTE: 'cliente',
    CEO: 'ceo',
    DIRETOR: 'diretor',
    COORDENADOR: 'coordenador',
    SUPERVISOR: 'supervisor',
    FISCAL: 'fiscal',
    FINANCEIRO_CAR: 'financeiro_car',
    FINANCEIRO_CAP: 'financeiro_cap',
    FINANCEIRO_RH: 'financeiro_rh',
    ORGANIZADORA: 'organizadora',
} as const;

export const PROTECTED_ROLES_NAMES = [
    ROLES.SUPER_ADMIN,
    ROLES.CLIENTE,
    ROLES.MOTOBOY
];

// Typescript Magic to convert the object values into a literal Union string
// Ex: "usuarios:ver" | "usuarios:criar" | ...
type ObjectValues<T> = T[keyof T];
export type PermissionKey = ObjectValues<{
    [K in keyof typeof PERMISSIONS]: ObjectValues<typeof PERMISSIONS[K]>;
}>;
