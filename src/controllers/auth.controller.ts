import { FastifyReply, FastifyRequest } from "fastify";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { authService } from "../services/auth.service.js";

export const AuthController = {
    async login(request: FastifyRequest, reply: FastifyReply) {
        const { cpf, password } = request.body as any;

        if (!cpf || !password) {
            return reply.status(400).send({ error: messages.auth.erro.cpfSenhaObrigatorios });
        }

        try {
            const session = await authService.login(cpf, password);
            return reply.status(200).send(session);
        } catch (err: any) {
            const status = err.message === messages.auth.erro.acessoNegado ? 403 : 401;
            return reply.status(status).send({ error: err.message });
        }
    },

    async refresh(request: FastifyRequest, reply: FastifyReply) {
        const { refresh_token } = request.body as any;

        if (!refresh_token) {
            return reply.status(400).send({ error: messages.auth.erro.refreshTokenObrigatorio });
        }

        try {
            const session = await authService.refreshToken(refresh_token);
            return reply.status(200).send(session);
        } catch (err: any) {
            return reply.status(401).send({ error: err.message });
        }
    },

    async logout(request: FastifyRequest, reply: FastifyReply) {
        const authHeader = request.headers.authorization;
        if (authHeader) {
            const token = authHeader.replace("Bearer ", "");
            await authService.logout(token);
        }
        return reply.status(200).send({ success: true, message: messages.auth.sucesso.logout });
    },

    async updatePassword(request: FastifyRequest, reply: FastifyReply) {
        const authHeader = request.headers.authorization;
        if (!authHeader) return reply.status(401).send({ error: messages.auth.erro.tokenAusente });
        
        const token = authHeader.replace("Bearer ", "");
        const { password, oldPassword } = request.body as any;

        if (!password) {
            return reply.status(400).send({ error: messages.auth.erro.senhaObrigatoria });
        }

        try {
            // Verify old password first if provided
            if (oldPassword) {
                 const { data: { user } } = await supabaseAdmin.auth.getUser(token);
                 if (user && user.email) {
                    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
                        email: user.email,
                        password: oldPassword
                    });
                    if (signInError) throw new Error(messages.auth.erro.senhaIncorreta);
                 }
            }

            await authService.updatePassword(token, password);
            return reply.status(200).send({ success: true, message: messages.auth.sucesso.senhaAtualizada });
        } catch (err: any) {
             return reply.status(400).send({ error: err.message });
        }
    },

    async register(request: FastifyRequest, reply: FastifyReply) {
        try {
            const result = await authService.selfRegister(request.body);
            return reply.status(201).send(result);
        } catch (err: any) {
            console.error("[AuthController.register] Erro:", err);
            return reply.status(400).send({ error: err.message });
        }
    },

    async forgotPassword(request: FastifyRequest, reply: FastifyReply) {
        const { email } = request.body as { email: string };
        if (!email) return reply.status(400).send({ error: messages.usuario.erro.emailObrigatorio });

        try {
            await authService.forgotPassword(email);
            return reply.status(200).send({ success: true, message: messages.auth.sucesso.emailRecuperacaoEnviado });
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    }
};
