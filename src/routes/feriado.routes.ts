import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { FeriadoController } from "../controllers/feriado.controller.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const feriadoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.FERIADOS.VER)] }, FeriadoController.list);
    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.FERIADOS.EDITAR)] }, FeriadoController.create);
    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.FERIADOS.EDITAR)] }, FeriadoController.update);
    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.FERIADOS.EDITAR)] }, FeriadoController.delete);
};

export default feriadoRoutes;
