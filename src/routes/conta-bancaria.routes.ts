import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { contaBancariaController } from "../controllers/conta-bancaria.controller.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const PERMISSOES_LEITURA_CONTA = [
  PERMISSIONS.CONTAS_BANCARIAS.VER,
  PERMISSIONS.FATURAMENTO.VER,
  PERMISSIONS.FATURAMENTO.EDITAR,
  PERMISSIONS.DESPESAS.VER,
  PERMISSIONS.DESPESAS.EDITAR,
  PERMISSIONS.CONVENIOS.VER,
  PERMISSIONS.CONVENIOS.EDITAR,
  PERMISSIONS.MOVIMENTACOES_AVULSAS.VER,
  PERMISSIONS.MOVIMENTACOES_AVULSAS.EDITAR,
  PERMISSIONS.CLIENTES.VER,
  PERMISSIONS.CLIENTES.EDITAR,
  PERMISSIONS.FLUXO_CAIXA.VER,
  PERMISSIONS.FINANCEIRO.EXTRATO,
  PERMISSIONS.FINANCEIRO.FECHAR,
  PERMISSIONS.FINANCEIRO.PAGAR,
];

const contaBancariaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/saldos",
    { preHandler: [verifyPermissao(PERMISSIONS.CONTAS_BANCARIAS.VER)] },
    contaBancariaController.listComSaldos
  );
  app.get(
    "/:id/extrato",
    { preHandler: [verifyPermissao(PERMISSIONS.CONTAS_BANCARIAS.VER)] },
    contaBancariaController.getExtrato
  );
  app.get(
    "/",
    { preHandler: [verifyPermissao(PERMISSOES_LEITURA_CONTA)] },
    contaBancariaController.list
  );
  app.get(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSOES_LEITURA_CONTA)] },
    contaBancariaController.get
  );
  app.post(
    "/",
    { preHandler: [verifyPermissao(PERMISSIONS.CONTAS_BANCARIAS.EDITAR)] },
    contaBancariaController.create
  );
  app.put(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.CONTAS_BANCARIAS.EDITAR)] },
    contaBancariaController.update
  );
  app.delete(
    "/:id",
    { preHandler: [verifyPermissao(PERMISSIONS.CONTAS_BANCARIAS.EDITAR)] },
    contaBancariaController.delete
  );
};

export default contaBancariaRoutes;
