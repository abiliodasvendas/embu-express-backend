import { FastifyReply, FastifyRequest } from "fastify";
import { feriadoService } from "../services/feriado.service.js";
import { feriadoSchema, updateFeriadoSchema } from "../schemas/feriado.schema.js";
import { z } from "zod";

export const FeriadoController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { ano } = z.object({ ano: z.string().optional().transform(val => val ? Number(val) : undefined) }).parse(request.query);
    const feriados = await feriadoService.listFeriados(ano);
    return reply.status(200).send(feriados);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const { data, descricao } = feriadoSchema.parse(request.body);
    const result = await feriadoService.createFeriado(data, descricao);
    return reply.status(201).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const { data, descricao } = updateFeriadoSchema.parse(request.body);
    const result = await feriadoService.updateFeriado(id, data, descricao);
    return reply.status(200).send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await feriadoService.deleteFeriado(id);
    return reply.status(200).send({ success: true });
  }
};
