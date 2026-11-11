import { FastifyRequest, FastifyReply } from "fastify";
import { contaBancariaService } from "../services/conta-bancaria.service.js";
import { extratoBancarioService } from "../services/extrato-bancario.service.js";
import { contaBancariaSchema, updateContaBancariaSchema } from "../schemas/conta-bancaria.schema.js";
import { z } from "zod";

export const contaBancariaController = {
  async getExtrato(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { mes, ano } = z
      .object({
        mes: z.coerce.number().int().min(1).max(12).optional(),
        ano: z.coerce.number().int().min(2020).max(2100).optional(),
      })
      .parse(request.query);

    const mesAlvo = mes || new Date().getMonth() + 1;
    const anoAlvo = ano || new Date().getFullYear();

    const result = await extratoBancarioService.getExtratoConta(id, mesAlvo, anoAlvo);
    return reply.send(result);
  },
  async listComSaldos(request: FastifyRequest, reply: FastifyReply) {
    const { empresa_id, mes, ano } = z.object({
      empresa_id: z.coerce.number().optional(),
      mes: z.coerce.number().optional(),
      ano: z.coerce.number().optional(),
    }).parse(request.query);

    const result = await contaBancariaService.listComSaldos(empresa_id, mes, ano);
    return reply.send(result);
  },

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
