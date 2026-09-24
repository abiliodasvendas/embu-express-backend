import { FastifyRequest, FastifyReply } from "fastify";
import { fluxoCaixaService } from "../services/fluxo-caixa.service.js";
import { fechamentoCaixaMensalSchema, fluxoCaixaQuerySchema } from "../schemas/fluxo-caixa.schema.js";

export const fluxoCaixaController = {
  async get(request: FastifyRequest, reply: FastifyReply) {
    const { mes, ano } = fluxoCaixaQuerySchema.parse(request.query);
    const result = await fluxoCaixaService.getFluxoCaixa(mes, ano);
    return reply.send(result);
  },

  async setSaldoInicial(request: FastifyRequest, reply: FastifyReply) {
    const data = fechamentoCaixaMensalSchema.parse(request.body);
    const userId = (request as any).user?.id;
    const result = await fluxoCaixaService.setSaldoInicial(
      data.mes,
      data.ano,
      data.saldo_inicial_consolidado,
      userId
    );
    return reply.send(result);
  },
};
