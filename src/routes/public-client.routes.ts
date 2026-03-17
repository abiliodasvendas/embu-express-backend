import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PublicClientController } from "../controllers/public-client.controller.js";

const publicClientRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/:uuid", PublicClientController.getClient);
    app.get("/:uuid/colaboradores", PublicClientController.listCollaborators);
    app.get("/:uuid/controle-ponto", PublicClientController.getControlePonto);
    app.get("/:uuid/espelho-ponto/:usuario_id", PublicClientController.getEspelhoPonto);
};

export default publicClientRoutes;
