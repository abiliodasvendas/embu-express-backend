import { FastifyReply, FastifyRequest } from "fastify";
import { pontoService } from "../services/ponto.service.js";
import { createPontoSchema, updatePontoSchema, togglePontoSchema, listPontoSchema, relatorioMensalSchema, iniciarPausaSchema, finalizarPausaSchema } from "../schemas/ponto.schema.js";
import { toPontoDTO, toPontoListDTO } from "../types/dtos/ponto.dto.js";
import { z } from "zod";

import { AuthenticatedRequest } from "../types/request.type.js";

export const PontoController = {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const data = createPontoSchema.parse(request.body);
    const result = await pontoService.registrarPonto(data);
    return reply.status(201).send(toPontoDTO(result));
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
    return reply.status(200).send({
        action: result.action,
        record: toPontoDTO(result.record)
    });
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const data = updatePontoSchema.parse(request.body);
    const result = await pontoService.updatePonto(id, data);
    return reply.status(200).send(toPontoDTO(result));
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await pontoService.deletePonto(id);
    return reply.status(204).send();
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const result = await pontoService.getPonto(id);
    if (!result) return reply.status(404).send({ error: "Registro não encontrado" });
    return reply.status(200).send(toPontoDTO(result));
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const filtros = listPontoSchema.parse(request.query);
    const result = await pontoService.listPontos(filtros);
    return reply.status(200).send(toPontoListDTO(result));
  },

  async getHoje(request: FastifyRequest, reply: FastifyReply) {
    const { usuarioId } = z.object({ usuarioId: z.string().uuid() }).parse(request.params);
    const result = await pontoService.getPontoHoje(usuarioId);
    return reply.status(200).send(result ? toPontoDTO(result) : null);
  },

  async getUltimoKm(request: FastifyRequest, reply: FastifyReply) {
    const { usuarioId } = z.object({ usuarioId: z.string().uuid() }).parse(request.params);
    const result = await pontoService.getUltimoKm(usuarioId);
    return reply.send({ km: result });
  },

  async relatorioMensal(request: FastifyRequest, reply: FastifyReply) {
    const { usuario_id, mes, ano } = relatorioMensalSchema.parse({
        ...(request.params as object),
        ...(request.query as object)
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
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const data = finalizarPausaSchema.parse(request.body);
    const result = await pontoService.finalizarPausa(id, data);
    return reply.status(200).send(result);
  }
};
