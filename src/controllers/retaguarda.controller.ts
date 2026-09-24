import { FastifyRequest, FastifyReply } from "fastify";
import { retaguardaService } from "../services/retaguarda.service.js";
import { alocacaoTemporariaSchema, retaguardaQuerySchema } from "../schemas/retaguarda.schema.js";
import { z } from "zod";

export const retaguardaController = {
  async getMonitor(request: FastifyRequest, reply: FastifyReply) {
    const { mes, ano } = retaguardaQuerySchema.parse(request.query);
    const result = await retaguardaService.getMonitorReservas(mes, ano);
    return reply.send(result);
  },

  async criarAlocacao(request: FastifyRequest, reply: FastifyReply) {
    const data = alocacaoTemporariaSchema.parse(request.body);
    const userId = (request as any).user?.id;
    const result = await retaguardaService.criarAlocacaoTemporaria(data, userId);
    return reply.status(201).send(result);
  },

  async listAlocacoes(request: FastifyRequest, reply: FastifyReply) {
    const { data } = z.object({ data: z.string().optional() }).parse(request.query);
    const result = await retaguardaService.listAlocacoes(data);
    return reply.send(result);
  },

  async getAlertaVales(request: FastifyRequest, reply: FastifyReply) {
    const { mes, ano } = retaguardaQuerySchema.parse(request.query);
    const result = await retaguardaService.getAlertaRiscoVales(mes, ano);
    return reply.send(result);
  },
};
