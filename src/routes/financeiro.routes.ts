import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { financeiroService } from "../services/financeiro.service.js";
import { fecharMesSchema, getExtratoSchema } from "../types/dtos/financeiro.dto.js";

const financeiroRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // Obter extrato mensal do colaborador
    app.get("/extrato-mensal/:usuarioId", {
        preHandler: [verifyPermissao([PERMISSIONS.FINANCEIRO.EXTRATO, PERMISSIONS.FINANCEIRO.VER_MEU])]
    }, async (request, reply) => {
        const { params, query } = getExtratoSchema.parse(request);

        try {
            const result = await financeiroService.getExtratoMensal(params.usuarioId, query.mes, query.ano);
            return reply.send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // Processar Pagamento (Snapshot + Marcação de Pago)
    app.post("/pagar/:usuarioId", {
        preHandler: [verifyPermissao(PERMISSIONS.FINANCEIRO.PAGAR)]
    }, async (request, reply) => {
        const { params, body } = fecharMesSchema.parse(request);
        const pagoPor = (request as any).user.id;

        try {
            const result = await financeiroService.processarPagamento(params.usuarioId, body.mes, body.ano, pagoPor);
            return reply.send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default financeiroRoutes;
