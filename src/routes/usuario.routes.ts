import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { UsuarioController } from "../controllers/usuario.controller.js";

const usuarioRoute: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.post("/", UsuarioController.create);
    app.put("/:id", UsuarioController.update);
    app.get("/:id", UsuarioController.get);
    app.get("/", UsuarioController.list);
    app.delete("/:id", UsuarioController.delete);
    app.patch("/:id/status", UsuarioController.updateStatus);

    // Rotas de Vínculos (Turnos)
    app.post("/vinculos", UsuarioController.createVinculo);
    app.put("/vinculos/:id", UsuarioController.updateVinculo);
    app.delete("/vinculos/:id", UsuarioController.deleteVinculo);
};

export default usuarioRoute;