import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { convenioAuditoriaService } from "../services/convenio-auditoria.service.js";
import {
  faturaFornecedorConvenioSchema,
  updateStatusFaturaFornecedorSchema,
} from "../schemas/convenio-auditoria.schema.js";

interface AuthenticatedRequest extends FastifyRequest {
  user?: {
    id: string;
    email: string;
  };
}

export const convenioAuditoriaController = {
  async getAuditoria(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
      id: z.string().uuid("ID do convênio inválido"),
    });
    const querySchema = z.object({
      mes: z.coerce.number().int().min(1).max(12),
      ano: z.coerce.number().int().min(2020),
    });

    const { id } = paramsSchema.parse(request.params);
    const { mes, ano } = querySchema.parse(request.query);

    const resultado = await convenioAuditoriaService.getAuditoriaMensal(id, mes, ano);
    return reply.status(200).send(resultado);
  },

  async salvarFatura(request: AuthenticatedRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
      id: z.string().uuid("ID do convênio inválido"),
    });
    const { id } = paramsSchema.parse(request.params);
    const data = faturaFornecedorConvenioSchema.parse({
      ...(request.body as Record<string, unknown>),
      convenio_id: id,
    });

    const userId = request.user?.id;
    const fatura = await convenioAuditoriaService.salvarFaturaFornecedor(data, userId);
    return reply.status(200).send(fatura);
  },

  async atualizarStatus(request: FastifyRequest, reply: FastifyReply) {
    const paramsSchema = z.object({
      id: z.string().uuid("ID do convênio inválido"),
      faturaId: z.string().uuid("ID da fatura inválido"),
    });
    const { faturaId } = paramsSchema.parse(request.params);
    const { status, observacoes } = updateStatusFaturaFornecedorSchema.parse(request.body);

    const fatura = await convenioAuditoriaService.atualizarStatusFatura(faturaId, status, observacoes);
    return reply.status(200).send(fatura);
  },

  async getResumoGeral(request: FastifyRequest, reply: FastifyReply) {
    const querySchema = z.object({
      mes: z.coerce.number().int().min(1).max(12),
      ano: z.coerce.number().int().min(2020),
    });
    const { mes, ano } = querySchema.parse(request.query);
    const resultado = await convenioAuditoriaService.getResumoGeralConvenios(mes, ano);
    return reply.status(200).send(resultado);
  },
};
