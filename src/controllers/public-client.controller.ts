import { FastifyReply, FastifyRequest } from "fastify";
import { publicClientService } from "../services/public-client.service.js";
import { publicIdSchema, controlePontoPublicSchema, espelhoPontoPublicSchema } from "../schemas/public-client.schema.js";

export const PublicClientController = {
  async getClient(request: FastifyRequest, reply: FastifyReply) {
    const { uuid } = publicIdSchema.parse(request.params);
    const client = await publicClientService.getClientByPublicId(uuid);
    return reply.send(client);
  },

  async listCollaborators(request: FastifyRequest, reply: FastifyReply) {
    const { uuid } = publicIdSchema.parse(request.params);
    const client = await publicClientService.getClientByPublicId(uuid);
    const result = await publicClientService.listCollaborators(client.id!);
    return reply.send(result);
  },

  async getControlePonto(request: FastifyRequest, reply: FastifyReply) {
    const { uuid } = publicIdSchema.parse(request.params);
    const { date } = controlePontoPublicSchema.parse(request.query);
    const client = await publicClientService.getClientByPublicId(uuid);
    const result = await publicClientService.getControlePonto(client.id!, date);
    return reply.send(result);
  },

  async getEspelhoPonto(request: FastifyRequest, reply: FastifyReply) {
    const { uuid } = publicIdSchema.parse(request.params);
    const { usuario_id } = request.params as { usuario_id: string };
    const { mes, ano } = espelhoPontoPublicSchema.parse(request.query);
    
    const client = await publicClientService.getClientByPublicId(uuid);
    const result = await publicClientService.getEspelhoPonto(client.id!, usuario_id, mes, ano);
    return reply.send(result);
  }
};
