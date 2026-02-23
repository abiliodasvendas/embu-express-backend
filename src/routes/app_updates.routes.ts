import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { getLatestUpdate } from "../controllers/app_updates.controller.js";

const appUpdatesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/updates", getLatestUpdate);
};

export default appUpdatesRoutes;
