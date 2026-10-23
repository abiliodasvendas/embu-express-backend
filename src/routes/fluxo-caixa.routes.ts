import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { fluxoCaixaController } from "../controllers/fluxo-caixa.controller.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const fluxoCaixaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/",
    { preHandler: [verifyPermissao(PERMISSIONS.FLUXO_CAIXA.VER)] },
    fluxoCaixaController.get
  );
  app.post(
    "/saldo-inicial",
    { preHandler: [verifyPermissao(PERMISSIONS.FLUXO_CAIXA.EDITAR)] },
    fluxoCaixaController.setSaldoInicial
  );
};

export default fluxoCaixaRoutes;
