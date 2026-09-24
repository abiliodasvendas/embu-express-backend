import { FastifyRequest, FastifyReply } from "fastify";
import { dreService } from "../services/dre.service.js";
import { z } from "zod";

export const dreController = {
  async get(request: FastifyRequest, reply: FastifyReply) {
    const { mes, ano, empresa_id } = z.object({
      mes: z.coerce.number().int().min(1).max(12),
      ano: z.coerce.number().int().min(2020),
      empresa_id: z.coerce.number().optional(),
    }).parse(request.query);

    const result = await dreService.getDRE(mes, ano, empresa_id);
    return reply.send(result);
  },
};
