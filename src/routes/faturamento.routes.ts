import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyAdminOnly } from "../middlewares/auth.middleware.js";
import { faturamentoController } from "../controllers/faturamento.controller.js";

const faturamentoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/sugestao", { preHandler: [verifyAdminOnly()] }, faturamentoController.getSugestao);
  app.get("/aging", { preHandler: [verifyAdminOnly()] }, faturamentoController.getAging);
  app.get("/", { preHandler: [verifyAdminOnly()] }, faturamentoController.list);
  app.get("/:id", { preHandler: [verifyAdminOnly()] }, faturamentoController.get);
  app.post("/", { preHandler: [verifyAdminOnly()] }, faturamentoController.create);
  app.put("/:id", { preHandler: [verifyAdminOnly()] }, faturamentoController.update);
  app.delete("/:id", { preHandler: [verifyAdminOnly()] }, faturamentoController.delete);
  app.post("/lote-recebimento", { preHandler: [verifyAdminOnly()] }, faturamentoController.processarRecebimentoLote);
};

export default faturamentoRoutes;
