import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { ConfiguracaoController } from "../controllers/configuracao.controller.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const configuracaoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.CONFIGURACAO.VER)] }, ConfiguracaoController.list);
    app.get("/:chave", { preHandler: [verifyPermissao(PERMISSIONS.CONFIGURACAO.VER)] }, ConfiguracaoController.get);
    app.put("/:chave", { preHandler: [verifyPermissao(PERMISSIONS.CONFIGURACAO.EDITAR)] }, ConfiguracaoController.update);
};

export default configuracaoRoutes;
