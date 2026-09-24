import { FastifyRequest, FastifyReply } from "fastify";
import { movimentacoesAvulsasService } from "../services/movimentacoes-avulsas.service.js";
import {
  movimentacaoAvulsaSchema,
  updateMovimentacaoAvulsaSchema,
  listMovimentacoesAvulsasQuerySchema,
} from "../schemas/movimentacoes-avulsas.schema.js";
import { z } from "zod";

export const movimentacoesAvulsasController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listMovimentacoesAvulsasQuerySchema.parse(request.query);
    const result = await movimentacoesAvulsasService.list(filtros);
    return reply.send(result);
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await movimentacoesAvulsasService.getById(id);
    return reply.send(result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = movimentacaoAvulsaSchema.parse(request.body);
    const userId = (request as any).user?.id;
    const result = await movimentacoesAvulsasService.create(data, userId);
    return reply.status(201).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = updateMovimentacaoAvulsaSchema.parse(request.body);
    const result = await movimentacoesAvulsasService.update(id, data);
    return reply.send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await movimentacoesAvulsasService.delete(id);
    return reply.status(204).send();
  },
};
