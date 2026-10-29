import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { contasPagarController } from "../controllers/contas-pagar.controller.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const contasPagarRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/unificado",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.VER)] },
    contasPagarController.list
  );

  app.post(
    "/lote",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.EDITAR)] },
    contasPagarController.processarLote
  );

  app.get(
    "/lotes",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.VER)] },
    contasPagarController.listLotes
  );

  app.post(
    "/:id/liquidar",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.EDITAR)] },
    contasPagarController.liquidarIndividual
  );
};

export default contasPagarRoutes;
