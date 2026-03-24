import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { OcorrenciaController } from "../controllers/ocorrencia.controller.js";

const ocorrenciaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // TIPOS DE OCORRÊNCIA
    app.get("/tipos", OcorrenciaController.listTipos);
    app.post("/tipos", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.TIPOS)] }, OcorrenciaController.createTipo);
    app.put("/tipos/:id", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.TIPOS)] }, OcorrenciaController.updateTipo);
    app.delete("/tipos/:id", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.TIPOS)] }, OcorrenciaController.deleteTipo);

    // OCORRÊNCIAS
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.VER)] }, OcorrenciaController.list);
    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.CRIAR)] }, OcorrenciaController.create);
    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.EDITAR)] }, OcorrenciaController.update);
    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.DELETAR)] }, OcorrenciaController.delete);
};

export default ocorrenciaRoutes;
