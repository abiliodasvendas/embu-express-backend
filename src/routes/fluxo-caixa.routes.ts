import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyAdminOnly } from "../middlewares/auth.middleware.js";
import { fluxoCaixaController } from "../controllers/fluxo-caixa.controller.js";

const fluxoCaixaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/", { preHandler: [verifyAdminOnly()] }, fluxoCaixaController.get);
  app.post("/saldo-inicial", { preHandler: [verifyAdminOnly()] }, fluxoCaixaController.setSaldoInicial);
};

export default fluxoCaixaRoutes;
