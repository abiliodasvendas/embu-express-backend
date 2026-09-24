import { FastifyRequest, FastifyReply } from "fastify";
import { despesaService } from "../services/despesa.service.js";
import {
  despesaOperacionalSchema,
  updateDespesaOperacionalSchema,
  listDespesasQuerySchema,
} from "../schemas/despesa.schema.js";
import { z } from "zod";

export const despesaController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listDespesasQuerySchema.parse(request.query);
    const result = await despesaService.list(filtros);
    return reply.send(result);
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await despesaService.getById(id);
    return reply.send(result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = despesaOperacionalSchema.parse(request.body);
    const userId = (request as any).user?.id;
    const result = await despesaService.create(data, userId);
    return reply.status(201).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = updateDespesaOperacionalSchema.parse(request.body);
    const result = await despesaService.update(id, data);
    return reply.send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await despesaService.delete(id);
    return reply.status(204).send();
  },

  async marcarPaga(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const body = z.object({
      data_pagamento: z.string().min(1),
      valor_pago: z.number().nonnegative().optional(),
    }).parse(request.body);

    const result = await despesaService.marcarPaga(id, body.data_pagamento, body.valor_pago);
    return reply.send(result);
  },

  async adiar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await despesaService.adiarDespesa(id);
    return reply.send(result);
  },
};
