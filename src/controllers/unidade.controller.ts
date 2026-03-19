import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { unidadeService } from "../services/unidade.service.js";
import { unidadeSchema, updateUnidadeSchema } from "../schemas/unidade.schema.js";
import { toUnidadeDTO, toUnidadeListDTO } from "../types/dtos/unidade.dto.js";

export const UnidadeController = {
  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = unidadeSchema.parse(request.body);
    const result = await unidadeService.createUnidade(data);
    return reply.status(201).send(toUnidadeDTO(result));
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const data = updateUnidadeSchema.parse(request.body);
    const result = await unidadeService.updateUnidade(id, data);
    return reply.status(200).send(toUnidadeDTO(result));
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await unidadeService.deleteUnidade(id);
    return reply.status(200).send({ success: true });
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const result = await unidadeService.getUnidade(id);
    return reply.status(200).send(toUnidadeDTO(result));
  },

  async listByCliente(request: FastifyRequest, reply: FastifyReply) {
    const { clienteId } = z.object({ clienteId: z.string().transform(Number) }).parse(request.params);
    const result = await unidadeService.listUnidadesByCliente(clienteId);
    return reply.status(200).send(toUnidadeListDTO(result));
  }
};
