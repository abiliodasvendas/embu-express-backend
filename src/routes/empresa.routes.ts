import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { EmpresaController } from "../controllers/empresa.controller.js";

const empresaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.EMPRESAS.VER)] }, EmpresaController.list);
    app.get("/:id", { preHandler: [verifyPermissao(PERMISSIONS.EMPRESAS.VER)] }, EmpresaController.getOne);
    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.EMPRESAS.CRIAR)] }, EmpresaController.create);
    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.EMPRESAS.EDITAR)] }, EmpresaController.update);
    app.patch("/:id/toggle-ativo", { preHandler: [verifyPermissao(PERMISSIONS.EMPRESAS.STATUS)] }, EmpresaController.toggleAtivo);
    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.EMPRESAS.DELETAR)] }, EmpresaController.delete);
};

export default empresaRoutes;
