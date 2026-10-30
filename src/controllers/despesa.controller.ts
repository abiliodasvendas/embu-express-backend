import { FastifyRequest, FastifyReply } from "fastify";
import { despesaService } from "../services/despesa.service.js";
import {
  despesaOperacionalSchema,
  updateDespesaOperacionalSchema,
  listDespesasQuerySchema,
  deleteDespesaQuerySchema,
} from "../schemas/despesa.schema.js";
import { z } from "zod";

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email?: string;
  };
}

export const despesaController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listDespesasQuerySchema.parse(request.query);
    const result = await despesaService.list(filtros);
    return reply.send(result);
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const result = await despesaService.getById(id);
    return reply.send(result);
  },

  async create(request: AuthenticatedRequest, reply: FastifyReply) {
    const data = despesaOperacionalSchema.parse(request.body);
    const userId = request.user?.id;
    const result = await despesaService.create(data, userId);
    return reply.status(201).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const data = updateDespesaOperacionalSchema.parse(request.body);
    const result = await despesaService.update(id, data);
    return reply.send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const { escopo } = deleteDespesaQuerySchema.parse(request.query);
    await despesaService.delete(id, escopo);
    return reply.status(204).send();
  },

  async marcarPaga(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = z.object({
      data_pagamento: z.string().min(1),
      valor_pago: z.number().nonnegative().optional(),
      conta_bancaria_id: z.string().uuid().optional(),
    }).parse(request.body);

    const result = await despesaService.marcarPaga(id, body.data_pagamento, body.valor_pago, body.conta_bancaria_id);
    return reply.send(result);
  },

  async adiar(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const result = await despesaService.adiarDespesa(id);
    return reply.send(result);
  },
};
