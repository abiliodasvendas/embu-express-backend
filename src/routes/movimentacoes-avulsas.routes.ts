import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { movimentacoesAvulsasController } from "../controllers/movimentacoes-avulsas.controller.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const movimentacoesAvulsasRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.MOVIMENTACOES_AVULSAS.VER,
          PERMISSIONS.CONTAS_BANCARIAS.VER,
        ]),
      ],
    },
    movimentacoesAvulsasController.list
  );
  app.get(
    "/:id",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.MOVIMENTACOES_AVULSAS.VER,
          PERMISSIONS.CONTAS_BANCARIAS.VER,
        ]),
      ],
    },
    movimentacoesAvulsasController.get
  );
  app.post(
    "/",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR,
          PERMISSIONS.CONTAS_BANCARIAS.EDITAR,
        ]),
      ],
    },
    movimentacoesAvulsasController.create
  );
  app.post(
    "/transferencia",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR,
          PERMISSIONS.CONTAS_BANCARIAS.EDITAR,
        ]),
      ],
    },
    movimentacoesAvulsasController.createTransferencia
  );
  app.put(
    "/:id",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR,
          PERMISSIONS.CONTAS_BANCARIAS.EDITAR,
        ]),
      ],
    },
    movimentacoesAvulsasController.update
  );
  app.delete(
    "/:id",
    {
      preHandler: [
        verifyPermissao([
          PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR,
          PERMISSIONS.CONTAS_BANCARIAS.EDITAR,
        ]),
      ],
    },
    movimentacoesAvulsasController.delete
  );
};

export default movimentacoesAvulsasRoutes;
