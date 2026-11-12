import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  createCategoriaFinanceiraSchema,
  listCategoriasFinanceirasQuerySchema,
  updateCategoriaFinanceiraSchema,
} from "../schemas/categoria-financeira.schema.js";
import { categoriaFinanceiraService } from "../services/categoria-financeira.service.js";

const idParamSchema = z.object({
  id: z.string().uuid("ID da categoria inválido"),
});

export const categoriaFinanceiraController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listCategoriasFinanceirasQuerySchema.parse(request.query);
    const result = await categoriaFinanceiraService.list(filtros);
    return reply.send(result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const dto = createCategoriaFinanceiraSchema.parse(request.body);
    const result = await categoriaFinanceiraService.create(dto);
    return reply.status(201).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    const dto = updateCategoriaFinanceiraSchema.parse(request.body);
    const result = await categoriaFinanceiraService.update(id, dto);
    return reply.send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = idParamSchema.parse(request.params);
    await categoriaFinanceiraService.delete(id);
    return reply.status(204).send();
  },
};
