import { FastifyRequest } from "fastify";
import { AuthUser } from "../services/auth.service.js";
import { Usuario } from "./database.js";

export interface AuthenticatedRequest extends FastifyRequest {
    user?: AuthUser;
    user_profile?: Usuario;
    user_perms?: string[];
}
