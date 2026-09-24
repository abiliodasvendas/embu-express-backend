import { FastifyRequest, FastifyReply } from "fastify";
import { faturamentoService } from "../services/faturamento.service.js";
import {
  faturaClienteSchema,
  updateFaturaClienteSchema,
  sugestaoMedicaoQuerySchema,
  loteRecebimentoSchema,
  faturaStatusEnum,
} from "../schemas/faturamento.schema.js";
import { z } from "zod";

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

export const faturamentoController = {
  async getSugestao(request: FastifyRequest, reply: FastifyReply) {
    const query = sugestaoMedicaoQuerySchema.parse(request.query);
    const result = await faturamentoService.calcularSugestaoMedicao(
      query.cliente_id,
      query.mes,
      query.ano,
      query.quinzena
    );
    return reply.send(result);
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = z.object({
      mes: z.coerce.number().optional(),
      ano: z.coerce.number().optional(),
      quinzena: z.coerce.number().optional(),
      empresa_id: z.coerce.number().optional(),
      cliente_id: z.coerce.number().optional(),
      status: faturaStatusEnum.optional(),
    }).parse(request.query);

    const result = await faturamentoService.listFaturas(filtros);
    return reply.send(result);
  },

  async get(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await faturamentoService.getFaturaById(id);
    return reply.send(result);
  },

  async create(request: AuthenticatedRequest, reply: FastifyReply) {
    const data = faturaClienteSchema.parse(request.body);
    const userId = request.user?.id;
    const result = await faturamentoService.createFatura(data, userId);
    return reply.status(201).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = updateFaturaClienteSchema.parse(request.body);
    const result = await faturamentoService.updateFatura(id, data);
    return reply.send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await faturamentoService.deleteFatura(id);
    return reply.status(204).send();
  },

  async processarRecebimentoLote(request: AuthenticatedRequest, reply: FastifyReply) {
    const data = loteRecebimentoSchema.parse(request.body);
    const userId = request.user?.id;
    const result = await faturamentoService.processarLoteRecebimento(data, userId);
    return reply.status(201).send(result);
  },

  async getAging(request: FastifyRequest, reply: FastifyReply) {
    const filtros = z.object({
      mes: z.coerce.number().optional(),
      ano: z.coerce.number().optional(),
      empresa_id: z.coerce.number().optional(),
    }).parse(request.query);

    const result = await faturamentoService.getAgingRecebiveis(filtros);
    return reply.send(result);
  },
};
