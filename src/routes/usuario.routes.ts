import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { UsuarioController } from "../controllers/usuario.controller.js";

const usuarioRoute: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.USUARIOS.CRIAR)] }, UsuarioController.create);
    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.USUARIOS.EDITAR)] }, UsuarioController.update);
    app.get("/:id", { preHandler: [verifyPermissao(PERMISSIONS.USUARIOS.VER)] }, UsuarioController.get);
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.USUARIOS.VER)] }, UsuarioController.list);
    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.USUARIOS.DELETAR)] }, UsuarioController.delete);
    app.patch("/:id/status", { preHandler: [verifyPermissao(PERMISSIONS.USUARIOS.STATUS)] }, UsuarioController.updateStatus);
    app.post("/:id/reset-password", { preHandler: [verifyPermissao(PERMISSIONS.USUARIOS.EDITAR)] }, UsuarioController.resetPassword);

    // Rotas de Vínculos (Turnos) - Editam o usuário no final das contas
    app.post("/vinculos", { preHandler: [verifyPermissao(PERMISSIONS.USUARIOS.EDITAR)] }, UsuarioController.createVinculo);
    app.put("/vinculos/:id", { preHandler: [verifyPermissao(PERMISSIONS.USUARIOS.EDITAR)] }, UsuarioController.updateVinculo);
    app.delete("/vinculos/:id", { preHandler: [verifyPermissao(PERMISSIONS.USUARIOS.EDITAR)] }, UsuarioController.deleteVinculo);
};

export default usuarioRoute;