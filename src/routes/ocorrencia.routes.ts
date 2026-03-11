import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { ocorrenciaService } from "../services/ocorrencia.service.js";

const ocorrenciaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // Listar tipos de ocorrência
    app.get("/tipos", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.TIPOS)] }, async (request, reply) => {
        try {
            const result = await ocorrenciaService.listTiposOcorrencia();
            return reply.send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // Criar tipo de ocorrência
    app.post("/tipos", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.TIPOS)] }, async (request, reply) => {
        const data = request.body as any;
        try {
            const result = await ocorrenciaService.createTipoOcorrencia(data);
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // Atualizar tipo de ocorrência
    app.put("/tipos/:id", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.TIPOS)] }, async (request, reply) => {
        const id = parseInt((request.params as any).id);
        const data = request.body as any;
        try {
            const result = await ocorrenciaService.updateTipoOcorrencia(id, data);
            return reply.send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // Deletar tipo de ocorrência
    app.delete("/tipos/:id", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.TIPOS)] }, async (request, reply) => {
        const id = parseInt((request.params as any).id);
        try {
            await ocorrenciaService.deleteTipoOcorrencia(id);
            return reply.status(204).send();
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // Listar ocorrências com filtros
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.VER)] }, async (request, reply) => {
        const filtros = request.query as any;
        try {
            const result = await ocorrenciaService.listOcorrencias(filtros);
            return reply.send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.CRIAR)] }, async (request, reply) => {
        const data = request.body as any;
        const userId = (request as any).user.id;
        
        try {
            const result = await ocorrenciaService.createOcorrencia({
                ...data,
                criado_por: userId
            });
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // Atualizar ocorrência
    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.EDITAR)] }, async (request, reply) => {
        const id = parseInt((request.params as any).id);
        const data = request.body as any;
        try {
            const result = await ocorrenciaService.updateOcorrencia(id, data);
            return reply.send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    // Deletar ocorrência
    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.OCORRENCIAS.DELETAR)] }, async (request, reply) => {
        const id = parseInt((request.params as any).id);
        try {
            await ocorrenciaService.deleteOcorrencia(id);
            return reply.status(204).send();
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default ocorrenciaRoutes;
