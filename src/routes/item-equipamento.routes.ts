import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { ItemEquipamentoController } from "../controllers/item-equipamento.controller.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const itemEquipamentoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/categorias", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.VER)] }, ItemEquipamentoController.listCategorias);
  app.post("/categorias", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.EDITAR)] }, ItemEquipamentoController.createCategoria);
  app.put("/categorias/:id", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.EDITAR)] }, ItemEquipamentoController.updateCategoria);
  app.delete("/categorias/:id", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.EDITAR)] }, ItemEquipamentoController.deleteCategoria);

  app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.VER)] }, ItemEquipamentoController.listItens);
  app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.EDITAR)] }, ItemEquipamentoController.createItem);
  app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.EDITAR)] }, ItemEquipamentoController.updateItem);
  app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.EDITAR)] }, ItemEquipamentoController.deleteItem);

  app.post("/alocar", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.EDITAR)] }, ItemEquipamentoController.associarItens);
  app.get("/:id/colaboradores", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.VER)] }, ItemEquipamentoController.listAlocadosPorItem);
  app.get("/colaborador/:id", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.VER)] }, ItemEquipamentoController.listItensColaborador);
  app.delete("/alocacao/:id", { preHandler: [verifyPermissao(PERMISSIONS.EQUIPAMENTOS.EDITAR)] }, ItemEquipamentoController.desassociarItem);
};

export default itemEquipamentoRoutes;
