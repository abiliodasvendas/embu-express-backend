import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { ClientController } from "../controllers/client.controller.js";

const clientRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.CRIAR)] }, ClientController.create);
    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.EDITAR)] }, ClientController.update);
    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.DELETAR)] }, ClientController.delete);
    app.patch("/:id/toggle-ativo", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.STATUS)] }, ClientController.toggleAtivo);
    app.get("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.VER)] }, ClientController.getOne);
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.VER)] }, ClientController.list);
};

export default clientRoutes;
