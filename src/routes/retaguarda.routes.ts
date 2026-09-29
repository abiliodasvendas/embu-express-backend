import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { retaguardaController } from "../controllers/retaguarda.controller.js";

const retaguardaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/monitor", { preHandler: [verifyPermissao(PERMISSIONS.RETAGUARDA.VER)] }, retaguardaController.getMonitor);
  app.get("/alerta-vales", { preHandler: [verifyPermissao(PERMISSIONS.RETAGUARDA.VER)] }, retaguardaController.getAlertaVales);
  app.get("/alocacoes", { preHandler: [verifyPermissao(PERMISSIONS.RETAGUARDA.VER)] }, retaguardaController.listAlocacoes);
  app.post("/alocacoes", { preHandler: [verifyPermissao(PERMISSIONS.RETAGUARDA.ALOCAR)] }, retaguardaController.criarAlocacao);
};

export default retaguardaRoutes;
