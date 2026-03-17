import { FastifyReply, FastifyRequest } from "fastify";
import { ocorrenciaService } from "../services/ocorrencia.service.js";
import { tipoOcorrenciaSchema, updateTipoOcorrenciaSchema, ocorrenciaSchema, updateOcorrenciaSchema, listOcorrenciaSchema } from "../schemas/ocorrencia.schema.js";

export const OcorrenciaController = {
  // --- TIPOS DE OCORRÊNCIA ---
  async listTipos(request: FastifyRequest, reply: FastifyReply) {
    const result = await ocorrenciaService.listTiposOcorrencia();
    return reply.send(result);
  },

  async createTipo(request: FastifyRequest, reply: FastifyReply) {
    const data = tipoOcorrenciaSchema.parse(request.body);
    const result = await ocorrenciaService.createTipoOcorrencia(data);
    return reply.status(201).send(result);
  },

  async updateTipo(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const data = updateTipoOcorrenciaSchema.parse(request.body);
    const result = await ocorrenciaService.updateTipoOcorrencia(id, data);
    return reply.send(result);
  },

  async deleteTipo(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    await ocorrenciaService.deleteTipoOcorrencia(id);
    return reply.status(204).send();
  },

  // --- OCORRÊNCIAS ---
  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listOcorrenciaSchema.parse(request.query);
    const result = await ocorrenciaService.listOcorrencias(filtros);
    return reply.send(result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = ocorrenciaSchema.parse(request.body);
    const userId = (request as any).user?.id;
    const result = await ocorrenciaService.createOcorrencia({
        ...data,
        criado_por: data.criado_por || userId
    });
    return reply.status(201).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const data = updateOcorrenciaSchema.parse(request.body);
    const result = await ocorrenciaService.updateOcorrencia(id, data);
    return reply.send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    await ocorrenciaService.deleteOcorrencia(id);
    return reply.status(204).send();
  }
};
