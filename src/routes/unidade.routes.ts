import { FastifyInstance } from "fastify";
import { UnidadeController } from "../controllers/unidade.controller.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

export async function unidadeRoutes(fastify: FastifyInstance) {
  fastify.post("/", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.CRIAR)] }, UnidadeController.create);
  fastify.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.EDITAR)] }, UnidadeController.update);
  fastify.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.DELETAR)] }, UnidadeController.delete);
  fastify.get("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.VER)] }, UnidadeController.getOne);
  fastify.get("/cliente/:clienteId", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.VER)] }, UnidadeController.listByCliente);
}
