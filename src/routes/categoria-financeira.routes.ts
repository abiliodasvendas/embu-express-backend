import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { categoriaFinanceiraController } from "../controllers/categoria-financeira.controller.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";

const categoriaFinanceiraRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.MOVIMENTACOES_AVULSAS.VER,
          PERMISSIONS.DESPESAS.VER,
          PERMISSIONS.CONTAS_BANCARIAS.VER,
          PERMISSIONS.FATURAMENTO.VER,
        ]),
      ],
    },
    categoriaFinanceiraController.list
  );

  app.post(
    "/",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR,
          PERMISSIONS.DESPESAS.EDITAR,
          PERMISSIONS.CONTAS_BANCARIAS.EDITAR,
        ]),
      ],
    },
    categoriaFinanceiraController.create
  );

  app.put(
    "/:id",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR,
          PERMISSIONS.DESPESAS.EDITAR,
          PERMISSIONS.CONTAS_BANCARIAS.EDITAR,
        ]),
      ],
    },
    categoriaFinanceiraController.update
  );

  app.delete(
    "/:id",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR,
          PERMISSIONS.DESPESAS.EDITAR,
          PERMISSIONS.CONTAS_BANCARIAS.EDITAR,
        ]),
      ],
    },
    categoriaFinanceiraController.delete
  );
};

export default categoriaFinanceiraRoutes;
