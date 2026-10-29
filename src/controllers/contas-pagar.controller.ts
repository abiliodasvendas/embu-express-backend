import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { contasPagarService } from "../services/contas-pagar.service.js";
import { lotePagamentoService } from "../services/lote-pagamento.service.js";
import {
  lotePagamentoSchema,
  queryContasPagarUnificadasSchema,
} from "../schemas/lote-pagamento.schema.js";
import { liquidarDespesaSchema } from "../schemas/despesa.schema.js";

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

export const contasPagarController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = queryContasPagarUnificadasSchema.parse(request.query);
    const result = await contasPagarService.listar(filtros);
    return reply.status(200).send(result);
  },

  async processarLote(request: AuthenticatedRequest, reply: FastifyReply) {
    const data = lotePagamentoSchema.parse(request.body);
    const userId = request.user?.id;
    const result = await lotePagamentoService.processarLote(data, userId);
    return reply.status(201).send(result);
  },

  async listLotes(request: FastifyRequest, reply: FastifyReply) {
    const query = z
      .object({
        mes: z.coerce.number().optional(),
        ano: z.coerce.number().optional(),
      })
      .parse(request.query);

    const result = await lotePagamentoService.listLotes(query.mes, query.ano);
    return reply.status(200).send(result);
  },

  async liquidarIndividual(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const data = liquidarDespesaSchema.parse(request.body);
    const query = z
      .object({
        tipo: z.enum(["DESPESA", "CONVENIO"]).default("DESPESA"),
      })
      .parse(request.query);

    const userId = request.user?.id;
    const result = await contasPagarService.liquidarItem(id, query.tipo, data, userId);
    return reply.status(200).send(result);
  },
};
