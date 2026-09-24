import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyAdminOnly } from "../middlewares/auth.middleware.js";
import { intercompanyController } from "../controllers/intercompany.controller.js";

const intercompanyRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/", { preHandler: [verifyAdminOnly()] }, intercompanyController.list);
  app.get("/matriz", { preHandler: [verifyAdminOnly()] }, intercompanyController.getMatrizSaldos);
  app.post("/acerto", { preHandler: [verifyAdminOnly()] }, intercompanyController.registrarAcerto);
};

export default intercompanyRoutes;
