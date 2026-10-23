import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { dreController } from "../controllers/dre.controller.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

const dreRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get(
    "/",
    { preHandler: [verifyPermissao(PERMISSIONS.DRE.VER)] },
    dreController.get
  );
};

export default dreRoutes;
