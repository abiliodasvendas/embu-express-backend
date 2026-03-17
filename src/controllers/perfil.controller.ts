import { FastifyReply, FastifyRequest } from "fastify";
import { perfilService } from "../services/perfil.service.js";
import { perfilSchema, updatePerfilSchema } from "../schemas/perfil.schema.js";

export const PerfilController = {
  async listPublic(request: FastifyRequest, reply: FastifyReply) {
    const result = await perfilService.listPublicPerfis();
    return reply.status(200).send(result);
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const result = await perfilService.listPerfis();
    return reply.status(200).send(result);
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const result = await perfilService.getPerfil(id);
    return reply.status(200).send(result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = perfilSchema.parse(request.body);
    const result = await perfilService.createPerfil({
        ...data,
        descricao: data.descricao ?? undefined
    });
    return reply.status(201).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const data = updatePerfilSchema.parse(request.body);
    const result = await perfilService.updatePerfil(id, {
        ...data,
        descricao: data.descricao ?? undefined
    });
    return reply.status(200).send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    await perfilService.deletePerfil(id);
    return reply.status(204).send();
  },

  async listPermissoes(request: FastifyRequest, reply: FastifyReply) {
    const result = await perfilService.listPermissoes();
    return reply.status(200).send(result);
  }
};
