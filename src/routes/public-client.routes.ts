import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { publicClientService } from "../services/public-client.service.js";

const publicClientRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // Middleware-like helper to validate client and inject ID
    const getClient = async (request: any) => {
        const { uuid } = request.params as { uuid: string };
        return await publicClientService.getClientByPublicId(uuid);
    };

    // GET /public/c/:uuid - Get client info
    app.get("/:uuid", async (request, reply) => {
        try {
            const client = await getClient(request);
            return reply.send(client);
        } catch (err: any) {
            return reply.status(401).send({ error: err.message });
        }
    });

    // GET /public/c/:uuid/colaboradores - List linked collaborators
    app.get("/:uuid/colaboradores", async (request, reply) => {
        try {
            const client = await getClient(request);
            const result = await publicClientService.listCollaborators(client.id);
            return reply.send(result);
        } catch (err: any) {
            return reply.status(401).send({ error: err.message });
        }
    });

    // GET /public/c/:uuid/controle-ponto - Daily time tracking
    app.get("/:uuid/controle-ponto", async (request, reply) => {
        try {
            const client = await getClient(request);
            const { date } = request.query as { date: string };
            if (!date) return reply.status(400).send({ error: "Data é obrigatória" });
            
            const result = await publicClientService.getControlePonto(client.id, date);
            return reply.send(result);
        } catch (err: any) {
            return reply.status(401).send({ error: err.message });
        }
    });

    // GET /public/c/:uuid/espelho-ponto/:usuario_id - Monthly time mirror
    app.get("/:uuid/espelho-ponto/:usuario_id", async (request, reply) => {
        try {
            const client = await getClient(request);
            const { usuario_id } = request.params as { usuario_id: string };
            const { mes, ano } = request.query as { mes: string; ano: string };
            
            if (!mes || !ano) return reply.status(400).send({ error: "Mês e Ano são obrigatórios" });

            const result = await publicClientService.getEspelhoPonto(client.id, usuario_id, parseInt(mes), parseInt(ano));
            return reply.send(result);
        } catch (err: any) {
            return reply.status(401).send({ error: err.message });
        }
    });
};

export default publicClientRoutes;
