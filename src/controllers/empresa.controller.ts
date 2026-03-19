import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { empresaService } from "../services/empresa.service.js";
import { empresaSchema, updateEmpresaSchema, listEmpresaSchema } from "../schemas/empresa.schema.js";
import { toEmpresaDTO, toEmpresaListDTO } from "../types/dtos/empresa.dto.js";

import { AuthenticatedRequest } from "../types/request.type.js";

export const EmpresaController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listEmpresaSchema.parse(request.query);
    const empresas = await empresaService.listEmpresas(filtros);
    return reply.status(200).send(toEmpresaListDTO(empresas));
  },

  async getOne(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const empresa = await empresaService.getEmpresa(id);
    if (!empresa) return reply.status(404).send({ error: "Empresa não encontrada" });
    return reply.status(200).send(toEmpresaDTO(empresa));
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = empresaSchema.parse(request.body);
    const novaEmpresa = await empresaService.createEmpresa(data);
    return reply.status(201).send(toEmpresaDTO(novaEmpresa));
  },

  async update(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const data = updateEmpresaSchema.parse(request.body);
    const atualizada = await empresaService.updateEmpresa(id, data);
    return reply.status(200).send(toEmpresaDTO(atualizada));
  },

  async toggleAtivo(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const { novoStatus } = z.object({ novoStatus: z.boolean() }).parse(request.body);

    await empresaService.toggleAtivo(id, novoStatus);
    return reply.status(200).send({ success: true, ativo: novoStatus });
  },

  async delete(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await empresaService.deleteEmpresa(id);
    return reply.status(200).send({ message: "Empresa excluída com sucesso" });
  }
};
