import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { ativMobWebhookController } from "../controllers/ativmob-webhook.controller.js";

const ativMobWebhookRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post("/", ativMobWebhookController.handle);
  app.post("/events", ativMobWebhookController.handle);
  app.get("/events", ativMobWebhookController.list);
};

export default ativMobWebhookRoutes;
