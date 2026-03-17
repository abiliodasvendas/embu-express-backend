import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { PerfilController } from "../controllers/perfil.controller.js";

const perfilRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/publico", PerfilController.listPublic);
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.VER)] }, PerfilController.list);
    app.get("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.VER)] }, PerfilController.getOne);
    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.CRIAR)] }, PerfilController.create);
    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.EDITAR)] }, PerfilController.update);
    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.DELETAR)] }, PerfilController.delete);
    app.get("/permissoes/lista", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.EDITAR)] }, PerfilController.listPermissoes);
};

export default perfilRoutes;
