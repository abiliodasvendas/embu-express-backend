import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyAdminOnly } from "../middlewares/auth.middleware.js";
import { dreController } from "../controllers/dre.controller.js";

const dreRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/", { preHandler: [verifyAdminOnly()] }, dreController.get);
};

export default dreRoutes;
