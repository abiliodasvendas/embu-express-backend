import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { faturamentoController } from "../controllers/faturamento.controller.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const faturamentoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/sugestao",
    { preHandler: [verifyPermissao(PERMISSIONS.FATURAMENTO.VER)] },
    faturamentoController.getSugestao
  );
  app.get(
    "/aging",
    { preHandler: [verifyPermissao(PERMISSIONS.FATURAMENTO.VER)] },
    faturamentoController.getAging
  );
  app.get(
    "/",
    { preHandler: [verifyPermissao(PERMISSIONS.FATURAMENTO.VER)] },
    faturamentoController.list
  );
  app.get(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.FATURAMENTO.VER)] },
    faturamentoController.get
  );
  app.post(
    "/:id/liquidar",
    { preHandler: [verifyPermissao(PERMISSIONS.FATURAMENTO.EDITAR)] },
    faturamentoController.liquidarIndividual
  );
  app.post(
    "/",
    { preHandler: [verifyPermissao(PERMISSIONS.FATURAMENTO.EDITAR)] },
    faturamentoController.create
  );
  app.put(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.FATURAMENTO.EDITAR)] },
    faturamentoController.update
  );
  app.delete(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.FATURAMENTO.EDITAR)] },
    faturamentoController.delete
  );
  app.post(
    "/lote-recebimento",
    { preHandler: [verifyPermissao(PERMISSIONS.FATURAMENTO.EDITAR)] },
    faturamentoController.processarRecebimentoLote
  );
};

export default faturamentoRoutes;
