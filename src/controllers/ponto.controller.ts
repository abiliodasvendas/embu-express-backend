import { FastifyReply, FastifyRequest } from "fastify";
import { pontoService } from "../services/ponto.service.js";
import { createPontoSchema, updatePontoSchema, togglePontoSchema, listPontoSchema, relatorioMensalSchema, iniciarPausaSchema, finalizarPausaSchema } from "../schemas/ponto.schema.js";

export const PontoController = {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const data = createPontoSchema.parse(request.body);
    const result = await pontoService.registrarPonto(data);
    return reply.status(201).send(result);
  },

  async toggle(request: FastifyRequest, reply: FastifyReply) {
    const { usuario_id, location, km, cliente_id, empresa_id, colaborador_cliente_id } = togglePontoSchema.parse(request.body);
    const result = await pontoService.togglePonto(
        usuario_id, 
        location ?? undefined, 
        km ?? undefined, 
        cliente_id ?? undefined, 
        empresa_id ?? undefined, 
        colaborador_cliente_id ?? undefined
    );
    return reply.status(200).send(result);
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const data = updatePontoSchema.parse(request.body);
    const result = await pontoService.updatePonto(id, data);
    return reply.status(200).send(result);
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    await pontoService.deletePonto(id);
    return reply.status(204).send();
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const result = await pontoService.getPonto(id);
    if (!result) return reply.status(404).send({ error: "Registro não encontrado" });
    return reply.status(200).send(result);
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listPontoSchema.parse(request.query);
    const result = await pontoService.listPontos(filtros);
    return reply.status(200).send(result);
  },

  async getHoje(request: FastifyRequest, reply: FastifyReply) {
    const { usuarioId } = request.params as any;
    if (!usuarioId) return reply.status(400).send({ error: "usuarioId obrigatório" });
    const result = await pontoService.getPontoHoje(usuarioId);
    return reply.status(200).send(result);
  },

  async getUltimoKm(request: FastifyRequest, reply: FastifyReply) {
      const { usuarioId } = request.params as any;
      const result = await pontoService.getUltimoKm(usuarioId);
      return reply.send({ km: result });
  },

  async relatorioMensal(request: FastifyRequest, reply: FastifyReply) {
    const { usuario_id, mes, ano } = relatorioMensalSchema.parse({
        ...request.params as any,
        ...request.query as any
    });
    const result = await pontoService.getRelatorioMensal(usuario_id, mes, ano);
    return reply.status(200).send(result);
  },

  async iniciarPausa(request: FastifyRequest, reply: FastifyReply) {
    const data = iniciarPausaSchema.parse(request.body);
    const result = await pontoService.iniciarPausa(data);
    return reply.status(201).send(result);
  },

  async finalizarPausa(request: FastifyRequest, reply: FastifyReply) {
    const id = Number((request.params as any).id);
    const data = finalizarPausaSchema.parse(request.body);
    if (!id) return reply.status(400).send({ error: "ID da pausa obrigatório" });
    const result = await pontoService.finalizarPausa(id, data);
    return reply.status(200).send(result);
  }
};
