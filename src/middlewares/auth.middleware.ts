import { FastifyReply, FastifyRequest } from "fastify";
import { supabaseAdmin } from "../config/supabase.js";
import { PERMISSIONS, PermissionKey, ROLES } from "../constants/permissions.enum.js";
import { authService } from "../services/auth.service.js"; // or similar to fetch user role
// In this case, we could query the permissions based on the token.

export function verifyPermissao(permissaoNecessaria: PermissionKey | PermissionKey[]) {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return reply.status(401).send({ error: "Token não fornecido." });
            }

            // 1. Get user from Auth
            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Token inválido ou expirado." });
            }

            // 2. Fetch User Profile and Permissions
            // Note: Since auth logic bypasses RLS using service_role, we query public.usuarios
            const { data: usuario, error: dbError } = await supabaseAdmin
                .from("usuarios")
                .select(`
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
                return reply.status(403).send({ error: "Usuário não encontrado." });
            }

            const nomePerfil = (usuario.perfil as any)?.nome;

            // 3. Super Admin Bypass
            if (nomePerfil === ROLES.SUPER_ADMIN) {
                return; // Acesso liberado
            }

            // 4. Self-Access Bypass (Allow user to view/edit their own data)
            const targetedId = (request.params as any)?.id;
            if (targetedId && targetedId === user.id) {
                return; // Allowed self-access bypass
            }

            const requiredPerms = Array.isArray(permissaoNecessaria) ? permissaoNecessaria : [permissaoNecessaria];

            // 5. Check permissions
            const permissoesArray = (usuario.perfil as any)?.perfil_permissoes?.map(
                (pp: any) => pp.permissao.nome_interno
            ) || [];

            const hasPermission = requiredPerms.some((p) => permissoesArray.includes(p));

            if (!hasPermission) {
                return reply.status(403).send({ error: "Acesso negado: você não tem permissão para esta ação." });
            }

            // If everything is fine, proceed
            return;
        } catch (error) {
            return reply.status(500).send({ error: "Erro interno ao verificar permissões." });
        }
    };
}

export function verifyOperacional() {
    return async (request: FastifyRequest, reply: FastifyReply) => {
        try {
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (!token) {
                return reply.status(401).send({ error: "Token não fornecido." });
            }

            const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
            if (authError || !user) {
                return reply.status(401).send({ error: "Token inválido ou expirado." });
            }

            const { data: usuario, error: dbError } = await supabaseAdmin
                .from("usuarios")
                .select(`
                    perfil:perfis(nome)
                `)
                .eq("id", user.id)
                .single();

            if (dbError || !usuario) {
                return reply.status(403).send({ error: "Usuário não encontrado." });
            }

            const nomePerfil = (usuario.perfil as any)?.nome;

            if (nomePerfil === ROLES.SUPER_ADMIN || nomePerfil !== ROLES.CLIENTE) {
                return; // Todos exceto CLIENTE têm acesso operacional.
            }

            return reply.status(403).send({ error: "Acesso negado." });
        } catch (error) {
            return reply.status(500).send({ error: "Erro interno." });
        }
    };
}
