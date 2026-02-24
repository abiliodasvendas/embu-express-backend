import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyOperacional, verifyPermissao } from "../middlewares/auth.middleware.js";
import { pontoService } from "../services/ponto.service.js";

const pontoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // ADMIN: Inserção manual de ponto
    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.PONTO.ADMIN_CRIAR)] }, async (request: any, reply) => {
        const data = request.body as any;
        try {
            const result = await pontoService.registrarPonto(data);
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // OPERACIONAL: Motoboy batendo ponto
    app.post("/toggle", { preHandler: [verifyOperacional()] }, async (request: any, reply) => {
        const { usuario_id, location, cliente_id, empresa_id } = request.body as any;

        if (!usuario_id) return reply.status(400).send({ error: "usuario_id obrigatório" });

        try {
            const result = await pontoService.togglePonto(usuario_id, location, cliente_id, empresa_id);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // OPERACIONAL / ADMIN: Ver ponto de hoje (Usado pelo App para mostrar status)
    // Permite que tanto quem bate ponto quanto quem monitora consigam ver.
    app.get("/hoje", {
        preHandler: [verifyOperacional()]
    }, async (request: any, reply) => {
        const { usuarioId } = request.query as any;

        if (!usuarioId) {
            return reply.status(400).send({ error: "usuarioId obrigatorio na query" });
        }

        try {
            const result = await pontoService.getPontoHoje(usuarioId);
            return reply.status(200).send(result);
        } catch (err: any) {
            console.error("[API] GET /hoje error:", err);
            return reply.status(400).send({ error: err.message });
        }
    });

    // ADMIN: Editar ponto manualmente
    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PONTO.ADMIN_EDITAR)] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        const data = request.body as any;
        try {
            const result = await pontoService.updatePonto(id, data);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // ADMIN: Deletar ponto
    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PONTO.ADMIN_DELETAR)] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            await pontoService.deletePonto(id);
            return reply.status(204).send();
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // ADMIN: Ver detalhes de um ponto específico
    app.get("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PONTO.ADMIN_VER)] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            const result = await pontoService.getPonto(id);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(404).send({ error: err.message });
        }
    });

    // ADMIN: Listar pontos
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.PONTO.ADMIN_VER)] }, async (request: any, reply) => {
        const filtros = request.query;
        try {
            const result = await pontoService.listPontos(filtros);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // OPERACIONAL / ADMIN
    app.get("/hoje/:usuarioId", {
        preHandler: [verifyOperacional()]
    }, async (request: any, reply) => {
        const usuarioId = request.params["usuarioId"] as string;
        try {
            const result = await pontoService.getPontoHoje(usuarioId);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // --- PAUSAS (OPERACIONAL) ---
    app.post("/pausa/inicio", { preHandler: [verifyOperacional()] }, async (request: any, reply) => {
        const data = request.body as any;
        try {
            const result = await pontoService.iniciarPausa(data);
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // RESTful: Iniciar pausa de um ponto específico
    app.post("/:id/pausas", { preHandler: [verifyOperacional()] }, async (request: any, reply) => {
        const ponto_id = parseInt(request.params["id"]);
        const data = request.body as any;
        try {
            const result = await pontoService.iniciarPausa({ ...data, ponto_id });
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.post("/pausa/fim", { preHandler: [verifyOperacional()] }, async (request: any, reply) => {
        const { id, ...data } = request.body as any;
        if (!id) return reply.status(400).send({ error: "ID da pausa obrigatório" });
        try {
            const result = await pontoService.finalizarPausa(id, data);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // RESTful: Finalizar uma pausa específica
    app.put("/pausas/:id", { preHandler: [verifyOperacional()] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        const data = request.body as any;
        try {
            const result = await pontoService.finalizarPausa(id, data);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default pontoRoutes;
