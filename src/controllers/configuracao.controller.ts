import { FastifyReply, FastifyRequest } from "fastify";
import { configuracaoService } from "../services/configuracao.service.js";
import { updateConfiguracaoSchema, configsValidationSchema } from "../types/dtos/configuracao.dto.js";

export const ConfiguracaoController = {
    list: async (_req: FastifyRequest, reply: FastifyReply) => {
        const result = await configuracaoService.listConfiguracoes();
        return reply.status(200).send(result);
    },

    get: async (req: FastifyRequest, reply: FastifyReply) => {
        const { chave } = req.params as { chave: string };
        const result = await configuracaoService.getConfiguracao(chave);

        if (!result) {
            return reply.status(404).send({ error: "Configuração não encontrada" });
        }

        return reply.status(200).send(result);
    },

    update: async (req: FastifyRequest, reply: FastifyReply) => {
        const { chave } = req.params as { chave: string };
        const body = updateConfiguracaoSchema.parse(req.body);

        // Validação específica por chave (se existir no schema)
        if (configsValidationSchema[chave]) {
            const validationResult = configsValidationSchema[chave].safeParse(body.valor);
            if (!validationResult.success) {
                return reply.status(400).send({
                    error: "Valor inválido para esta configuração",
                    details: validationResult.error.format()
                });
            }
        }

        const result = await configuracaoService.updateConfiguracao(chave, body.valor);
        return reply.status(200).send(result);
    },
};
