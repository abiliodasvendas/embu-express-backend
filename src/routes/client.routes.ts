import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { clientService } from "../services/client.service.js";

const clientRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.CRIAR)] }, async (request: any, reply) => {
        const data = request.body as any;
        try {
            const result = await clientService.createClient(data);
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.EDITAR)] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        const data = request.body as any;
        try {
            const result = await clientService.updateClient(id, data);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.DELETAR)] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            await clientService.deleteClient(id);
            return reply.status(200).send({ success: true });
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.patch("/:id/toggle-ativo", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.STATUS)] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        const { novoStatus } = request.body as { novoStatus: boolean };
        try {
            const result = await clientService.toggleAtivo(id, novoStatus);
            return reply.status(200).send({ ativo: result });
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.get("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.VER)] }, async (request: any, reply) => {
        const id = parseInt(request.params["id"]);
        try {
            const result = await clientService.getClient(id);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(404).send({ error: err.message });
        }
    });

    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.CLIENTES.VER)] }, async (request: any, reply) => {
        const { searchTerm, ativo, includeId } = request.query;
        try {
            const result = await clientService.listClients({
                searchTerm,
                ativo,
                includeId
            });
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default clientRoutes;
