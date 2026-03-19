import { FastifyReply, FastifyRequest } from "fastify";
import { ocorrenciaService } from "../services/ocorrencia.service.js";
import { tipoOcorrenciaSchema, updateTipoOcorrenciaSchema, ocorrenciaSchema, updateOcorrenciaSchema, listOcorrenciaSchema } from "../schemas/ocorrencia.schema.js";
import { toTipoOcorrenciaDTO, toTipoOcorrenciaListDTO, toOcorrenciaDTO, toOcorrenciaListDTO } from "../types/dtos/ocorrencia.dto.js";
import { z } from "zod";

import { AuthenticatedRequest } from "../types/request.type.js";

export const OcorrenciaController = {
  // --- TIPOS DE OCORRÊNCIA ---
  async listTipos(request: AuthenticatedRequest, reply: FastifyReply) {
    const result = await ocorrenciaService.listTiposOcorrencia();
    return reply.send(toTipoOcorrenciaListDTO(result));
  },

  async createTipo(request: FastifyRequest, reply: FastifyReply) {
    const data = tipoOcorrenciaSchema.parse(request.body);
    const result = await ocorrenciaService.createTipoOcorrencia(data);
    return reply.status(201).send(toTipoOcorrenciaDTO(result));
  },

  async updateTipo(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const data = updateTipoOcorrenciaSchema.parse(request.body);
    const result = await ocorrenciaService.updateTipoOcorrencia(id, data);
    return reply.send(toTipoOcorrenciaDTO(result));
  },

  async deleteTipo(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await ocorrenciaService.deleteTipoOcorrencia(id);
    return reply.status(204).send();
  },

  // --- OCORRÊNCIAS ---
  async list(request: AuthenticatedRequest, reply: FastifyReply) {
    const filtros = listOcorrenciaSchema.parse(request.query);
    const result = await ocorrenciaService.listOcorrencias(filtros);
    return reply.send(toOcorrenciaListDTO(result));
  },

  async create(request: AuthenticatedRequest, reply: FastifyReply) {
    const data = ocorrenciaSchema.parse(request.body);
    const userId = request.user?.id;
    const result = await ocorrenciaService.createOcorrencia({
        ...data,
        criado_por: data.criado_por || userId
    });
    return reply.status(201).send(toOcorrenciaDTO(result));
  },

  async update(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const data = updateOcorrenciaSchema.parse(request.body);
    const result = await ocorrenciaService.updateOcorrencia(id, data);
    return reply.send(toOcorrenciaDTO(result));
  },

  async delete(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await ocorrenciaService.deleteOcorrencia(id);
    return reply.status(204).send();
  }
};
