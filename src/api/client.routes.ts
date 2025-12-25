import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { clientService } from "../services/client.service.js";

const clientRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.post("/", async (request: any, reply) => {
        const data = request.body as any;
        try {
            const result = await clientService.createClient(data);
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.put("/:id", async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        const data = request.body as any;
        try {
            const result = await clientService.updateClient(id, data);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.delete("/:id", async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            await clientService.deleteClient(id);
            return reply.status(200).send({ success: true });
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.patch("/:id/toggle-status", async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        const { status } = request.body as { status: string };
        try {
            const result = await clientService.updateClient(id, { status });
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.get("/:id", async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            const result = await clientService.getClient(id);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(404).send({ error: err.message });
        }
    });

    app.get("/", async (request: any, reply) => {
        const { searchTerm, ativo } = request.query;
        try {
            const result = await clientService.listClients({
                searchTerm,
                ativo
            });
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default clientRoutes;
