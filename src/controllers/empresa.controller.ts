import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { empresaService } from "../services/empresa.service.js";
import { empresaSchema, updateEmpresaSchema, listEmpresaSchema } from "../schemas/empresa.schema.js";

export const EmpresaController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listEmpresaSchema.parse(request.query);
    const empresas = await empresaService.listEmpresas(filtros);
    return reply.status(200).send(empresas);
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const empresa = await empresaService.getEmpresa(id);
    return reply.status(200).send(empresa);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const data = empresaSchema.parse(request.body);
    const novaEmpresa = await empresaService.createEmpresa(data);
    return reply.status(201).send(novaEmpresa);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const data = updateEmpresaSchema.parse(request.body);
    const atualizada = await empresaService.updateEmpresa(id, data);
    return reply.status(200).send(atualizada);
  },

  async toggleAtivo(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const { novoStatus } = z.object({ novoStatus: z.boolean() }).parse(request.body);

    await empresaService.toggleAtivo(id, novoStatus);
    return reply.status(200).send({ success: true, ativo: novoStatus });
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    await empresaService.deleteEmpresa(id);
    return reply.status(200).send({ message: "Empresa excluída com sucesso" });
  }
};
