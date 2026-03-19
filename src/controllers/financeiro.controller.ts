import { FastifyReply, FastifyRequest } from "fastify";
import { financeiroService } from "../services/financeiro.service.js";
import { fecharMesSchema, getExtratoSchema } from "../types/dtos/financeiro.dto.js";

interface AuthenticatedRequest extends FastifyRequest {
    user?: {
        id: string;
        email: string;
    };
}

export const FinanceiroController = {
  async getExtrato(request: FastifyRequest, reply: FastifyReply) {
    const { params, query } = getExtratoSchema.parse(request);
    const result = await financeiroService.getExtratoMensal(params.usuarioId, query.mes, query.ano);
    return reply.send(result);
  },

  async pagar(request: AuthenticatedRequest, reply: FastifyReply) {
    const { params, body } = fecharMesSchema.parse(request);
    const pagoPor = request.user?.id;
    if (!pagoPor) return reply.status(401).send({ error: "Usuário não autenticado" });
    const result = await financeiroService.processarPagamento(params.usuarioId, body.mes, body.ano, pagoPor);
    return reply.send(result);
  },

  async confirmarAdiantamento(request: AuthenticatedRequest, reply: FastifyReply) {
    const { params, body } = fecharMesSchema.parse(request);
    const confirmadoPor = request.user?.id;
    if (!confirmadoPor) return reply.status(401).send({ error: "Usuário não autenticado" });
    const result = await financeiroService.confirmarAdiantamento(params.usuarioId, body.mes, body.ano, confirmadoPor);
    return reply.send(result);
  },

  async desconfirmarAdiantamento(request: FastifyRequest, reply: FastifyReply) {
    const { params, query } = getExtratoSchema.parse(request);
    await financeiroService.desconfirmarAdiantamento(params.usuarioId, query.mes, query.ano);
    return reply.status(204).send();
  },

  async desfazerPagamento(request: FastifyRequest, reply: FastifyReply) {
    const { params, query } = getExtratoSchema.parse(request);
    await financeiroService.desfazerPagamento(params.usuarioId, query.mes, query.ano);
    return reply.status(204).send();
  }
};
