import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { pontoService } from "../services/ponto.service.js";

const pontoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.post("/", async (request: any, reply) => {
        const data = request.body as any;
        try {
            const result = await pontoService.registrarPonto(data);
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.post("/bater", async (request: any, reply) => {
        const { usuario_id } = request.body as any;
        if (!usuario_id) return reply.status(400).send({ error: "usuario_id obrigatório" });
        try {
            const result = await pontoService.togglePonto(usuario_id);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.put("/:id", async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        const data = request.body as any;
        try {
            const result = await pontoService.updatePonto(id, data);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.delete("/:id", async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            await pontoService.deletePonto(id);
            return reply.status(204).send();
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.get("/:id", async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            const result = await pontoService.getPonto(id);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(404).send({ error: err.message });
        }
    });

    app.get("/", async (request: any, reply) => {
        const filtros = request.query;
        try {
            const result = await pontoService.listPontos(filtros);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.get("/hoje/:usuarioId", async (request: any, reply) => {
        const usuarioId = request.params["usuarioId"] as string;
        try {
            const result = await pontoService.getPontoHoje(usuarioId);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default pontoRoutes;
