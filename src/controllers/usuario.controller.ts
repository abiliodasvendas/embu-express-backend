import { FastifyReply, FastifyRequest } from "fastify";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { usuarioService } from "../services/usuario.service.js";
import { createVinculoSchema, updateVinculoSchema } from "../types/dtos/colaborador-cliente.dto.js";
import { AppError } from "../errors/AppError.js";
import { z } from "zod";
import { logger } from "../config/logger.js";

export const UsuarioController = {
    async create(request: FastifyRequest, reply: FastifyReply) {
        try {
            // No DTO for full user creation yet, but following pattern
            const result = await usuarioService.createUsuario(request.body as any);
            return reply.status(201).send(result);
        } catch (err: any) {
            logger.error(err, "[UsuarioController] Erro ao criar usuário");
            return reply.status(err.statusCode || 400).send({ error: err.message });
        }
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
        try {
            const id = (request.params as any).id as string;
            if (!id) throw new AppError(messages.usuario.erro.idObrigatorio);

            const result = await usuarioService.updateUsuario(id, request.body as any);
            return reply.status(200).send(result);
        } catch (err: any) {
            logger.error(err, "[UsuarioController] Erro ao atualizar usuário");
            return reply.status(err.statusCode || 400).send({ error: err.message });
        }
    },

    async get(request: FastifyRequest, reply: FastifyReply) {
        try {
            const id = (request.params as any).id as string;
            if (!id) throw new AppError(messages.usuario.erro.idObrigatorio);

            const result = await usuarioService.getUsuario(id);
            return reply.status(200).send(result);
        } catch (err: any) {
            logger.error(err, "[UsuarioController] Erro ao buscar usuário");
            return reply.status(err.statusCode || 404).send({ error: err.message });
        }
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { searchTerm, perfil_id, cliente_id, status, empresa_id } = request.query as any;
            const result = await usuarioService.listUsuarios({
                searchTerm,
                perfil_id,
                cliente_id,
                empresa_id,
                status
            });
            return reply.status(200).send(result);
        } catch (err: any) {
            logger.error(err, "[UsuarioController] Erro ao listar usuários");
            return reply.status(err.statusCode || 400).send({ error: err.message });
        }
    },

    async delete(request: FastifyRequest, reply: FastifyReply) {
        try {
            const id = (request.params as any).id as string;
            if (!id) throw new AppError(messages.usuario.erro.idObrigatorio);

            // Security check: Prevent self-deletion
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (token) {
                const { data: { user } } = await supabaseAdmin.auth.getUser(token);
                if (user && user.id === id) {
                    throw new AppError(messages.usuario.erro.autoExclusao);
                }
            }

            await usuarioService.deleteUsuario(id);
            return reply.status(200).send({ success: true });
        } catch (err: any) {
            logger.error(err, "[UsuarioController] Erro ao excluir usuário");
            return reply.status(err.statusCode || 400).send({ error: err.message });
        }
    },

    async updateStatus(request: FastifyRequest, reply: FastifyReply) {
        try {
            const id = (request.params as any).id as string;
            const { status } = request.body as { status: string };

            if (!id) throw new AppError(messages.usuario.erro.idObrigatorio);

            // Security check: Prevent self-deactivation if setting to INATIVO
            if (status === 'INATIVO') {
                const token = request.headers.authorization?.replace('Bearer ', '');
                if (token) {
                    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
                    if (user && user.id === id) {
                        throw new AppError(messages.usuario.erro.autoDesativacao);
                    }
                }
            }

            const result = await usuarioService.updateStatus(id, status);
            return reply.status(200).send({ status: result });
        } catch (err: any) {
            logger.error(err, "[UsuarioController] Erro ao atualizar status");
            return reply.status(err.statusCode || 400).send({ error: err.message });
        }
    },

    // --- Vínculos (Turnos) ---

    async createVinculo(request: FastifyRequest, reply: FastifyReply) {
        try {
            const data = createVinculoSchema.parse(request.body);
            // Import dynamically to avoid circular dependency if any, though here it's fine.
            const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
            const result = await colaboradorClienteService.createLink(data);
            return reply.status(201).send(result);
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.issues[0].message });
            }
            return reply.status(err.statusCode || 400).send({ error: err.message });
        }
    },

    async updateVinculo(request: FastifyRequest, reply: FastifyReply) {
        try {
            const id = parseInt((request.params as any).id);
            if (isNaN(id)) throw new AppError("ID do vínculo inválido");

            const data = updateVinculoSchema.parse(request.body);
            const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
            const result = await colaboradorClienteService.updateLink(id, data);
            return reply.status(200).send(result);
        } catch (err: any) {
            if (err instanceof z.ZodError) {
                return reply.status(400).send({ error: err.issues[0].message });
            }
            return reply.status(err.statusCode || 400).send({ error: err.message });
        }
    },

    async deleteVinculo(request: FastifyRequest, reply: FastifyReply) {
        try {
            const id = parseInt((request.params as any).id);
            if (isNaN(id)) throw new AppError("ID do vínculo inválido");

            const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
            await colaboradorClienteService.deleteLink(id);
            return reply.status(200).send({ success: true });
        } catch (err: any) {
            logger.error(err, "[UsuarioController] Erro ao excluir vínculo");
            return reply.status(err.statusCode || 400).send({ error: err.message });
        }
    }
};
