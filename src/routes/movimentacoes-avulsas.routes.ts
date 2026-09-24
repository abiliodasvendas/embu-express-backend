import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { movimentacoesAvulsasController } from "../controllers/movimentacoes-avulsas.controller.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const movimentacoesAvulsasRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/",
    { preHandler: [verifyPermissao(PERMISSIONS.MOVIMENTACOES_AVULSAS.VER)] },
    movimentacoesAvulsasController.list
  );
  app.get(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.MOVIMENTACOES_AVULSAS.VER)] },
    movimentacoesAvulsasController.get
  );
  app.post(
    "/",
    { preHandler: [verifyPermissao(PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR)] },
    movimentacoesAvulsasController.create
  );
  app.put(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR)] },
    movimentacoesAvulsasController.update
  );
  app.delete(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR)] },
    movimentacoesAvulsasController.delete
  );
};

export default movimentacoesAvulsasRoutes;
