import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { perfilService } from "../services/perfil.service.js";

const perfilRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/", async (request, reply) => {
        try {
            const result = await perfilService.listPerfis();
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.get("/:id", async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            const result = await perfilService.getPerfil(id);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(404).send({ error: err.message });
        }
    });
};

export default perfilRoutes;
