import { FastifyReply, FastifyRequest } from "fastify";
import { perfilService } from "../services/perfil.service.js";
import { perfilSchema, updatePerfilSchema } from "../schemas/perfil.schema.js";
import { z } from "zod";
import { toPerfilDTO, toPerfilListDTO } from "../types/dtos/perfil.dto.js";

export const PerfilController = {
  async listPublic(request: FastifyRequest, reply: FastifyReply) {
    const result = await perfilService.listPublicPerfis();
    return reply.status(200).send(result);
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const result = await perfilService.listPerfis();
    return reply.status(200).send(toPerfilListDTO(result));
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const result = await perfilService.getPerfil(id);
    return reply.status(200).send(toPerfilDTO(result));
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = perfilSchema.parse(request.body);
    const result = await perfilService.createPerfil({
        ...data,
        descricao: data.descricao ?? undefined
    });
    return reply.status(201).send(toPerfilDTO(result));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const data = updatePerfilSchema.parse(request.body);
    const result = await perfilService.updatePerfil(id, {
        ...data,
        descricao: data.descricao ?? undefined
    });
    return reply.status(200).send(toPerfilDTO(result));
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await perfilService.deletePerfil(id);
    return reply.status(204).send();
  },

  async listPermissoes(request: FastifyRequest, reply: FastifyReply) {
    const result = await perfilService.listPermissoes();
    return reply.status(200).send(result);
  }
};
