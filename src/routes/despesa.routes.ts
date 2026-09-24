import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyAdminOnly } from "../middlewares/auth.middleware.js";
import { despesaController } from "../controllers/despesa.controller.js";

const despesaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/", { preHandler: [verifyAdminOnly()] }, despesaController.list);
  app.get("/:id", { preHandler: [verifyAdminOnly()] }, despesaController.get);
  app.post("/", { preHandler: [verifyAdminOnly()] }, despesaController.create);
  app.put("/:id", { preHandler: [verifyAdminOnly()] }, despesaController.update);
  app.delete("/:id", { preHandler: [verifyAdminOnly()] }, despesaController.delete);
  app.patch("/:id/pagar", { preHandler: [verifyAdminOnly()] }, despesaController.marcarPaga);
  app.patch("/:id/adiar", { preHandler: [verifyAdminOnly()] }, despesaController.adiar);
};

export default despesaRoutes;
