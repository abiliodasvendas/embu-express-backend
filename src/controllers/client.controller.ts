import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { clientService } from "../services/client.service.js";
import { clientSchema, updateClientSchema, listClientSchema } from "../schemas/client.schema.js";
import { toClientDTO, toClientListDTO } from "../types/dtos/client.dto.js";

import { AuthenticatedRequest } from "../types/request.type.js";

export const ClientController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = clientSchema.parse(request.body);
    const result = await clientService.createClient(data);
    return reply.status(201).send(toClientDTO(result));
  },

  async update(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const data = updateClientSchema.parse(request.body);
    const result = await clientService.updateClient(id, data);
    return reply.status(200).send(toClientDTO(result));
  },

  async delete(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await clientService.deleteClient(id);
    return reply.status(200).send({ success: true });
  },

  async toggleAtivo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const { novoStatus } = z.object({ novoStatus: z.boolean() }).parse(request.body);
    const result = await clientService.toggleAtivo(id, novoStatus);
    return reply.status(200).send({ ativo: result });
  },

  async getOne(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const result = await clientService.getClient(id);
    if (!result) return reply.status(404).send({ error: "Cliente não encontrado" });
    return reply.status(200).send(toClientDTO(result));
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listClientSchema.parse(request.query);
    const result = await clientService.listClients(filtros);
    return reply.status(200).send(toClientListDTO(result));
  }
};
