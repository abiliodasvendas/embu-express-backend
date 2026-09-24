import { FastifyRequest, FastifyReply } from "fastify";
import { intercompanyService } from "../services/intercompany.service.js";
import { acertoIntercompanySchema } from "../schemas/faturamento.schema.js";
import { z } from "zod";

export const intercompanyController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = z.object({
      status: z.enum(["PENDENTE_ACERTO", "COMPENSADO"]).optional(),
      empresaCredoraId: z.coerce.number().optional(),
      empresaDevedoraId: z.coerce.number().optional(),
    }).parse(request.query);

    const result = await intercompanyService.listTransferencias(filtros);
    return reply.send(result);
  },

  async getMatrizSaldos(request: FastifyRequest, reply: FastifyReply) {
    const result = await intercompanyService.getMatrizSaldos();
    return reply.send(result);
  },

  async registrarAcerto(request: FastifyRequest, reply: FastifyReply) {
    const data = acertoIntercompanySchema.parse(request.body);
    const result = await intercompanyService.registrarAcerto(data);
    return reply.send(result);
  },
};
