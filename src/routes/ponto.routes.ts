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

    app.post("/toggle", async (request: any, reply) => {
        // Agora aceita location
        const { usuario_id, location } = request.body as any;
        
        // Se nao vier no body, tentar pegar do usuario logado (se houver middleware)
        // Por enquanto, mobile manda no body
        if (!usuario_id) return reply.status(400).send({ error: "usuario_id obrigatório" });
        
        try {
            const result = await pontoService.togglePonto(usuario_id, location);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // Endpoint flexivel para "Hoje"
    app.get("/hoje", async (request: any, reply) => {
         const { usuarioId } = request.query as any;
         
         if (!usuarioId) {
             return reply.status(400).send({ error: "usuarioId obrigatorio na query" });
         }
         
         try {
            const result = await pontoService.getPontoHoje(usuarioId);
            // IMPORTANT: Return null if not found, NOT empty object, otherwise frontend thinks it's a valid record
            return reply.status(200).send(result);
         } catch (err: any) {
            console.error("[API] GET /hoje error:", err);
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

    // --- PAUSAS ---
    app.post("/pausa/inicio", async (request: any, reply) => {
        const data = request.body as any;
        try {
             // data expecting { ponto_id, inicio_loc, ... }
             const result = await pontoService.iniciarPausa(data);
             return reply.status(201).send(result);
        } catch (err: any) {
             return reply.status(400).send({ error: err.message });
        }
    });

    app.post("/pausa/fim", async (request: any, reply) => {
        const { id, ...data } = request.body as any;
        if (!id) return reply.status(400).send({ error: "ID da pausa obrigatório" });
        try {
             const result = await pontoService.finalizarPausa(id, data);
             return reply.status(200).send(result);
        } catch (err: any) {
             return reply.status(400).send({ error: err.message });
        }
    });
};

export default pontoRoutes;
