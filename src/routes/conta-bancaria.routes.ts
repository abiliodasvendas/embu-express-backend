import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { verifyAdminOnly } from "../middlewares/auth.middleware.js";
import { contaBancariaController } from "../controllers/conta-bancaria.controller.js";

const contaBancariaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/", { preHandler: [verifyAdminOnly()] }, contaBancariaController.list);
  app.get("/:id", { preHandler: [verifyAdminOnly()] }, contaBancariaController.get);
  app.post("/", { preHandler: [verifyAdminOnly()] }, contaBancariaController.create);
  app.put("/:id", { preHandler: [verifyAdminOnly()] }, contaBancariaController.update);
  app.delete("/:id", { preHandler: [verifyAdminOnly()] }, contaBancariaController.delete);
};

export default contaBancariaRoutes;
