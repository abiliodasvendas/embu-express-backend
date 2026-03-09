import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { financeiroService } from "../services/financeiro.service.js";
import { getExtratoSchema, fecharMesSchema, marcarPagoSchema } from "../types/dtos/financeiro.dto.js";

const financeiroRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // Obter extrato mensal do colaborador
    app.get("/extrato-mensal/:usuarioId", {
        preHandler: [verifyPermissao(PERMISSIONS.FINANCEIRO.EXTRATO)]
    }, async (request, reply) => {
        const { params, query } = getExtratoSchema.parse(request);

        try {
            const result = await financeiroService.getExtratoMensal(params.usuarioId, query.mes, query.ano);
            return reply.send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // Fechar mês (Snapshot)
    app.post("/fechar/:usuarioId", {
        preHandler: [verifyPermissao(PERMISSIONS.FINANCEIRO.FECHAR)]
    }, async (request, reply) => {
        const { params, body } = fecharMesSchema.parse(request);
        const fechadoPor = (request as any).user.id;

        try {
            const result = await financeiroService.confirmarFechamento(params.usuarioId, body.mes, body.ano, fechadoPor);
            return reply.send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // Marcar como pago
    app.put("/pagar/:id", {
        preHandler: [verifyPermissao(PERMISSIONS.FINANCEIRO.PAGAR)]
    }, async (request, reply) => {
        const { params } = marcarPagoSchema.parse(request);

        try {
            const result = await financeiroService.marcarComoPago(params.id);
            return reply.send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default financeiroRoutes;
