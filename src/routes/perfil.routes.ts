import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { perfilService } from "../services/perfil.service.js";

const perfilRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.VER)] }, async (request, reply) => {
        try {
            const result = await perfilService.listPerfis();
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.get("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.VER)] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            const result = await perfilService.getPerfil(id);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(404).send({ error: err.message });
        }
    });
    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.CRIAR)] }, async (request: any, reply) => {
        try {
            const result = await perfilService.createPerfil(request.body);
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.EDITAR)] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            const result = await perfilService.updatePerfil(id, request.body);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.DELETAR)] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            await perfilService.deletePerfil(id);
            return reply.status(204).send();
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.get("/permissoes/lista", { preHandler: [verifyPermissao(PERMISSIONS.PERFIS.EDITAR)] }, async (request, reply) => {
        try {
            const result = await perfilService.listPermissoes();
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default perfilRoutes;
