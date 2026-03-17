import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { FinanceiroController } from "../controllers/financeiro.controller.js";

const financeiroRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/extrato-mensal/:usuarioId", {
        preHandler: [verifyPermissao([PERMISSIONS.FINANCEIRO.EXTRATO, PERMISSIONS.FINANCEIRO.VER_MEU])]
    }, FinanceiroController.getExtrato);

    app.post("/pagar/:usuarioId", {
        preHandler: [verifyPermissao(PERMISSIONS.FINANCEIRO.PAGAR)]
    }, FinanceiroController.pagar);

    app.post("/confirmar-adiantamento/:usuarioId", {
        preHandler: [verifyPermissao(PERMISSIONS.FINANCEIRO.PAGAR)]
    }, FinanceiroController.confirmarAdiantamento);

    app.delete("/desconfirmar-adiantamento/:usuarioId", {
        preHandler: [verifyPermissao(PERMISSIONS.FINANCEIRO.PAGAR)]
    }, FinanceiroController.desconfirmarAdiantamento);

    app.delete("/desfazer-pagamento/:usuarioId", {
        preHandler: [verifyPermissao(PERMISSIONS.FINANCEIRO.PAGAR)]
    }, FinanceiroController.desfazerPagamento);
};

export default financeiroRoutes;
