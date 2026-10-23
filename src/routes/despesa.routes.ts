import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { despesaController } from "../controllers/despesa.controller.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const despesaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.VER)] },
    despesaController.list
  );
  app.get(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.VER)] },
    despesaController.get
  );
  app.post(
    "/",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.EDITAR)] },
    despesaController.create
  );
  app.put(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.EDITAR)] },
    despesaController.update
  );
  app.delete(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.EDITAR)] },
    despesaController.delete
  );
  app.patch(
    "/:id/pagar",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.EDITAR)] },
    despesaController.marcarPaga
  );
  app.patch(
    "/:id/adiar",
    { preHandler: [verifyPermissao(PERMISSIONS.DESPESAS.EDITAR)] },
    despesaController.adiar
  );
};

export default despesaRoutes;
