import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  categoriaItemService,
  itemEquipamentoService,
  alocacaoItemService,
} from "../services/item-equipamento.service.js";
import {
  categoriaItemSchema,
  itemEquipamentoSchema,
  associarItemSchema,
} from "../schemas/item-equipamento.schema.js";

export const ItemEquipamentoController = {
  async listCategorias(request: FastifyRequest, reply: FastifyReply) {
    const categorias = await categoriaItemService.listCategorias();
    return reply.status(200).send(categorias);
  },

  async createCategoria(request: FastifyRequest, reply: FastifyReply) {
    const { nome } = categoriaItemSchema.parse(request.body);
    const result = await categoriaItemService.createCategoria(nome);
    return reply.status(201).send(result);
  },

  async updateCategoria(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const { nome } = categoriaItemSchema.parse(request.body);
    const result = await categoriaItemService.updateCategoria(id, nome);
    return reply.status(200).send(result);
  },

  async deleteCategoria(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await categoriaItemService.deleteCategoria(id);
    return reply.status(200).send({ success: true });
  },

  async listItens(request: FastifyRequest, reply: FastifyReply) {
    const itens = await itemEquipamentoService.listItens();
    return reply.status(200).send(itens);
  },

  async createItem(request: FastifyRequest, reply: FastifyReply) {
    const { nome, categoria_id, ativo } = itemEquipamentoSchema.parse(request.body);
    const result = await itemEquipamentoService.createItem(nome, categoria_id, ativo);
    return reply.status(201).send(result);
  },

  async updateItem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const { nome, categoria_id, ativo } = itemEquipamentoSchema.parse(request.body);
    const result = await itemEquipamentoService.updateItem(id, nome, categoria_id, ativo);
    return reply.status(200).send(result);
  },

  async deleteItem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await itemEquipamentoService.deleteItem(id);
    return reply.status(200).send({ success: true });
  },

  async associarItens(request: FastifyRequest, reply: FastifyReply) {
    const { colaborador_id, itens_ids, observacao } = associarItemSchema.parse(request.body);
    const criadoPor = request.user?.id;
    const result = await alocacaoItemService.associarItens(
      colaborador_id,
      itens_ids,
      criadoPor,
      observacao
    );
    return reply.status(201).send(result);
  },

  async listAlocadosPorItem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    const alocados = await alocacaoItemService.listAlocadosPorItem(id);
    return reply.status(200).send(alocados);
  },

  async listItensColaborador(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const itens = await alocacaoItemService.listItensColaborador(id);
    return reply.status(200).send(itens);
  },

  async desassociarItem(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().transform(Number) }).parse(request.params);
    await alocacaoItemService.desassociarItem(id);
    return reply.status(200).send({ success: true });
  },

  async desassociarTodosItensColaborador(request: FastifyRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    await alocacaoItemService.desassociarTodosItensColaborador(id);
    return reply.status(200).send({ success: true });
  },
};
