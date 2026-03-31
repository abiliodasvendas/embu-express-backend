import { FastifyReply, FastifyRequest } from "fastify";
import { messages } from "../constants/messages.js";
import { authService } from "../services/auth.service.js";
import { loginSchema, refreshSchema, updatePasswordSchema, registerSchema } from "../schemas/auth.schema.js";
import { AppError } from "../errors/AppError.js";

export const AuthController = {
    async login(request: FastifyRequest, reply: FastifyReply) {
        const { cpf, password } = loginSchema.parse(request.body);
        const session = await authService.login(cpf, password);
        return reply.status(200).send(session);
    },

    async refresh(request: FastifyRequest, reply: FastifyReply) {
        const { refresh_token } = refreshSchema.parse(request.body);
        const session = await authService.refreshToken(refresh_token);
        return reply.status(200).send(session);
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
        if (!authHeader) throw new AppError(messages.auth.erro.tokenAusente, 401);

        const token = authHeader.replace("Bearer ", "");
        const { password, oldPassword } = updatePasswordSchema.parse(request.body);

        const session = await authService.updatePassword(token, password, oldPassword);
        return reply.status(200).send({ success: true, message: messages.auth.sucesso.senhaAtualizada, session });
    },

    async register(request: FastifyRequest, reply: FastifyReply) {
        const data = registerSchema.parse(request.body);
        const result = await authService.selfRegister(data);
        return reply.status(201).send(result);
    },

};
