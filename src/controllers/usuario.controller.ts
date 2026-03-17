import { FastifyReply, FastifyRequest } from "fastify";
import { usuarioService } from "../services/usuario.service.js";
import { createUsuarioSchema, updateUsuarioSchema, usuarioStatusSchema } from "../schemas/usuario.schema.js";
import { createVinculoSchema, updateVinculoSchema } from "../types/dtos/colaborador-cliente.dto.js";

export const UsuarioController = {
    async create(request: FastifyRequest, reply: FastifyReply) {
        const data = createUsuarioSchema.parse(request.body);
        const result = await usuarioService.createUsuario(data);
        return reply.status(201).send(result);
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
        const id = (request.params as any).id as string;
        const data = updateUsuarioSchema.parse(request.body);
        const executorId = (request as any).user?.id;
        const result = await usuarioService.updateUsuario(id, data, executorId);
        return reply.status(200).send(result);
    },

    async get(request: FastifyRequest, reply: FastifyReply) {
        const id = (request.params as any).id as string;
        const result = await usuarioService.getUsuario(id);
        return reply.status(200).send(result);
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
        const { searchTerm, perfil_id, cliente_id, status, empresa_id } = request.query as any;
        const result = await usuarioService.listUsuarios({
            searchTerm,
            perfil_id,
            cliente_id,
            empresa_id,
            status
        });
        return reply.status(200).send(result);
    },

    async delete(request: FastifyRequest, reply: FastifyReply) {
        const id = (request.params as any).id as string;
        const executorId = (request as any).user?.id;
        await usuarioService.deleteUsuario(id, executorId);
        return reply.status(200).send({ success: true });
    },

    async updateStatus(request: FastifyRequest, reply: FastifyReply) {
        const id = (request.params as any).id as string;
        const { status } = usuarioStatusSchema.parse(request.body);
        const executorId = (request as any).user?.id;
        const result = await usuarioService.updateStatus(id, status, executorId);
        return reply.status(200).send({ status: result });
    },

    async createVinculo(request: FastifyRequest, reply: FastifyReply) {
        const data = createVinculoSchema.parse(request.body);
        const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
        const result = await colaboradorClienteService.createLink(data);
        return reply.status(201).send(result);
    },

    async updateVinculo(request: FastifyRequest, reply: FastifyReply) {
        const id = parseInt((request.params as any).id);
        const data = updateVinculoSchema.parse(request.body);
        const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
        const result = await colaboradorClienteService.updateLink(id, data);
        return reply.status(200).send(result);
    },

    async deleteVinculo(request: FastifyRequest, reply: FastifyReply) {
        const id = parseInt((request.params as any).id);
        const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
        await colaboradorClienteService.deleteLink(id);
        return reply.status(200).send({ success: true });
    }
};
