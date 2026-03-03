import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { financeiroService } from "../services/financeiro.service.js";

const financeiroRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // Obter extrato mensal do colaborador
    app.get("/extrato-mensal/:usuarioId", { preHandler: [verifyPermissao(PERMISSIONS.FINANCEIRO.EXTRATO)] }, async (request, reply) => {
        const usuarioId = (request.params as any).usuarioId;
        const { mes, ano } = request.query as any;

        if (!mes || !ano) {
            return reply.status(400).send({ error: "Mes e ano sao obrigatorios." });
        }

        try {
            const result = await financeiroService.getExtratoMensal(usuarioId, parseInt(mes), parseInt(ano));
            return reply.send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default financeiroRoutes;
