import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { intercompanyController } from "../controllers/intercompany.controller.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const intercompanyRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.FATURAMENTO.VER,
          PERMISSIONS.DESPESAS.VER,
        ]),
      ],
    },
    intercompanyController.list
  );
  app.get(
    "/matriz",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.FATURAMENTO.VER,
          PERMISSIONS.DESPESAS.VER,
        ]),
      ],
    },
    intercompanyController.getMatrizSaldos
  );
  app.post(
    "/acerto",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.FATURAMENTO.EDITAR,
          PERMISSIONS.DESPESAS.EDITAR,
        ]),
      ],
    },
    intercompanyController.registrarAcerto
  );
};

export default intercompanyRoutes;
