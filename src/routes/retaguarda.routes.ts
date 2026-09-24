import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyAdminOnly } from "../middlewares/auth.middleware.js";
import { retaguardaController } from "../controllers/retaguarda.controller.js";

const retaguardaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/monitor", { preHandler: [verifyAdminOnly()] }, retaguardaController.getMonitor);
  app.get("/alerta-vales", { preHandler: [verifyAdminOnly()] }, retaguardaController.getAlertaVales);
  app.get("/alocacoes", { preHandler: [verifyAdminOnly()] }, retaguardaController.listAlocacoes);
  app.post("/alocacoes", { preHandler: [verifyAdminOnly()] }, retaguardaController.criarAlocacao);
};

export default retaguardaRoutes;
