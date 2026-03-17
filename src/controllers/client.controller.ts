import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { clientService } from "../services/client.service.js";
import { clientSchema, updateClientSchema, listClientSchema } from "../schemas/client.schema.js";

export const ClientController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = clientSchema.parse(request.body);
    const result = await clientService.createClient(data);
    return reply.status(201).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const data = updateClientSchema.parse(request.body);
    const result = await clientService.updateClient(id, data);
    return reply.status(200).send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    await clientService.deleteClient(id);
    return reply.status(200).send({ success: true });
  },

  async toggleAtivo(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const { novoStatus } = z.object({ novoStatus: z.boolean() }).parse(request.body);
    const result = await clientService.toggleAtivo(id, novoStatus);
    return reply.status(200).send({ ativo: result });
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const result = await clientService.getClient(id);
    return reply.status(200).send(result);
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listClientSchema.parse(request.query);
    const result = await clientService.listClients(filtros);
    return reply.status(200).send(result);
  }
};
