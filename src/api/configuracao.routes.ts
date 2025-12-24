import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { configuracaoService } from "../services/configuracao.service.js";

const configuracaoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.get("/", async (request, reply) => {
        try {
            const result = await configuracaoService.listConfiguracoes();
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.get("/:chave", async (request: any, reply) => {
        const chave = request.params["chave"] as string;
        try {
            const result = await configuracaoService.getConfiguracao(chave);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(404).send({ error: err.message });
        }
    });

    app.put("/:chave", async (request: any, reply) => {
        const chave = request.params["chave"] as string;
        const { valor } = request.body as { valor: string };
        try {
            const result = await configuracaoService.updateConfiguracao(chave, valor);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default configuracaoRoutes;
