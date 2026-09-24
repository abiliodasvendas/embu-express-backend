import { FastifyRequest, FastifyReply } from "fastify";
import { contaBancariaService } from "../services/conta-bancaria.service.js";
import { contaBancariaSchema, updateContaBancariaSchema } from "../schemas/conta-bancaria.schema.js";
import { z } from "zod";

export const contaBancariaController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { empresa_id } = z.object({
      empresa_id: z.coerce.number().optional(),
    }).parse(request.query);

    const result = await contaBancariaService.list(empresa_id);
    return reply.send(result);
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await contaBancariaService.getById(id);
    return reply.send(result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = contaBancariaSchema.parse(request.body);
    const result = await contaBancariaService.create(data);
    return reply.status(201).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = updateContaBancariaSchema.parse(request.body);
    const result = await contaBancariaService.update(id, data);
    return reply.send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await contaBancariaService.delete(id);
    return reply.status(204).send();
  },
};
