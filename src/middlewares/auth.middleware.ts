import { FastifyReply, FastifyRequest } from "fastify";
import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { PermissionKey, ROLES } from "../constants/permissions.enum.js";
import { AuthenticatedRequest } from "../types/request.type.js";
import { AuthUser } from "../services/auth.service.js";
import { Usuario } from "../types/database.js";

export function verifyPermissao(permissaoNecessaria: PermissionKey | PermissionKey[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return reply.status(401).send({ error: messages.auth.erro.tokenAusente });
            }

            // 1. Get user from Auth
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: messages.auth.erro.tokenInvalido });
            }

            // Attach user to request for use in routes
            (request as AuthenticatedRequest).user = user as AuthUser;

            // 2. Fetch User Profile and Permissions
            // Note: Since auth logic bypasses RLS using service_role, we query public.usuarios
            const { data: usuario, error: dbError } = await supabaseAdmin
                .from("usuarios")
                .select(`
                    status,
                    perfil:perfis(
                        nome,
                        perfil_permissoes(
                            permissao:permissoes(nome_interno)
                        )
                    )
                `)
                .eq("id", user.id)
                .single();

            if (dbError || !usuario) {
                return reply.status(403).send({ error: messages.auth.erro.usuarioNaoEncontrado });
            }

            if (usuario.status !== CADASTRO_STATUS.ATIVO) {
                return reply.status(403).send({ error: messages.auth.erro.acessoNegado });
            }

            const perfilData = usuario.perfil as unknown as { nome: string, perfil_permissoes: { permissao: { nome_interno: string } }[] };
            const nomePerfil = perfilData?.nome;

            // 3. Super Admin Bypass
            if (nomePerfil === ROLES.SUPER_ADMIN) {
                return; // Acesso liberado
            }

            // 4. Self-Access Bypass (Allow user to view/edit their own data)
            const params = request.params as { id?: string; usuarioId?: string; usuario_id?: string };
            const targetedId = params?.id || params?.usuarioId || params?.usuario_id;

            if (targetedId && targetedId === user.id) {
                return; // Allowed self-access bypass
            }

            const requiredPerms = Array.isArray(permissaoNecessaria) ? permissaoNecessaria : [permissaoNecessaria];

            // 5. Check permissions
            const permissoesArray = perfilData?.perfil_permissoes?.map(
                (pp) => pp.permissao.nome_interno
            ) || [];

            const hasPermission = requiredPerms.some((p) => permissoesArray.includes(p));

            if (!hasPermission) {
                return reply.status(403).send({ error: messages.sistema.erro.naoAutorizado });
            }

            // Attach profile and permissions to request for further checks in handlers
            (request as AuthenticatedRequest).user_profile = usuario as unknown as Usuario;
            (request as AuthenticatedRequest).user_perms = permissoesArray;

            // If everything is fine, proceed
            return;
        } catch (error) {
            return reply.status(500).send({ error: messages.sistema.erro.interno });
        }
    };
}

export function verifyOperacional() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return reply.status(401).send({ error: messages.auth.erro.tokenAusente });
            }

            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: messages.auth.erro.tokenInvalido });
            }

            const { data: usuario, error: dbError } = await supabaseAdmin
                .from("usuarios")
                .select(`
                    status,
                    perfil:perfis(nome)
                `)
                .eq("id", user.id)
                .single();

            if (dbError || !usuario) {
                return reply.status(403).send({ error: messages.auth.erro.usuarioNaoEncontrado });
            }

            if (usuario.status !== CADASTRO_STATUS.ATIVO) {
                return reply.status(403).send({ error: messages.auth.erro.acessoNegado });
            }

            const nomePerfil = (usuario.perfil as unknown as { nome: string })?.nome;

            if (nomePerfil === ROLES.SUPER_ADMIN || nomePerfil !== ROLES.CLIENTE) {
                return; // Todos exceto CLIENTE têm acesso operacional.
            }

            return reply.status(403).send({ error: messages.sistema.erro.naoAutorizado });
        } catch (error) {
            return reply.status(500).send({ error: messages.sistema.erro.interno });
        }
    };
}
