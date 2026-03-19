import { FastifyReply, FastifyRequest } from "fastify";
import { usuarioService } from "../services/usuario.service.js";
import { createUsuarioSchema, updateUsuarioSchema, usuarioStatusSchema } from "../schemas/usuario.schema.js";
import { createVinculoSchema, updateVinculoSchema } from "../types/dtos/colaborador-cliente.dto.js";
import { toUsuarioDTO, toUsuarioListDTO } from "../types/dtos/usuario.dto.js";
import { z } from "zod";

import { AuthenticatedRequest } from "../types/request.type.js";

export const UsuarioController = {
    async create(request: FastifyRequest, reply: FastifyReply) {
        const data = createUsuarioSchema.parse(request.body);
        const result = await usuarioService.createUsuario(data);
        return reply.status(201).send(toUsuarioDTO(result));
    },

    async update(request: AuthenticatedRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
        const data = updateUsuarioSchema.parse(request.body);
        const executorId = request.user?.id;
        const result = await usuarioService.updateUsuario(id, data, executorId);
        return reply.status(200).send(toUsuarioDTO(result));
    },

    async get(request: FastifyRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
        const result = await usuarioService.getUsuario(id);
        if (!result) return reply.status(404).send({ error: "Usuário não encontrado" });
        return reply.status(200).send(toUsuarioDTO(result));
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
        const filtros = z.object({
            searchTerm: z.string().optional(),
            perfil_id: z.string().optional().transform(val => val ? Number(val) : undefined),
            cliente_id: z.string().optional().transform(val => val ? Number(val) : undefined),
            empresa_id: z.string().optional().transform(val => val ? Number(val) : undefined),
            status: z.string().optional()
        }).parse(request.query);

        const result = await usuarioService.listUsuarios(filtros);
        return reply.status(200).send(toUsuarioListDTO(result));
    },

    async delete(request: AuthenticatedRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
        const executorId = request.user?.id;
        await usuarioService.deleteUsuario(id, executorId);
        return reply.status(200).send({ success: true });
    },

    async updateStatus(request: AuthenticatedRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
        const { status } = usuarioStatusSchema.parse(request.body);
        const executorId = request.user?.id;
        const result = await usuarioService.updateStatus(id, status, executorId);
        return reply.status(200).send({ status: result });
    },

    async resetPassword(request: AuthenticatedRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
        const executorId = request.user?.id;
        await usuarioService.resetPassword(id, executorId);
        return reply.status(200).send({ success: true, message: "Senha resetada para o padrão com sucesso" });
    },

    async createVinculo(request: FastifyRequest, reply: FastifyReply) {
        const data = createVinculoSchema.parse(request.body);
        const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
        const { toVinculoDTO } = await import("../types/dtos/colaborador-cliente.dto.js");
        const result = await colaboradorClienteService.createLink(data);
        return reply.status(201).send(toVinculoDTO(result));
    },

    async updateVinculo(request: FastifyRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
        const data = updateVinculoSchema.parse(request.body);
        const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
        const { toVinculoDTO } = await import("../types/dtos/colaborador-cliente.dto.js");
        const result = await colaboradorClienteService.updateLink(id, data);
        return reply.status(200).send(toVinculoDTO(result));
    },

    async deleteVinculo(request: FastifyRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
        const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
        await colaboradorClienteService.deleteLink(id);
        return reply.status(200).send({ success: true });
    }
};
