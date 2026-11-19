import { FastifyReply, FastifyRequest } from "fastify";
import { listarAniversariantesQuerySchema } from "../schemas/aniversariante.schema.js";
import { aniversarianteService } from "../services/aniversariante.service.js";

export const AniversarianteController = {
    async list(request: FastifyRequest, reply: FastifyReply) {
        const { mes } = listarAniversariantesQuerySchema.parse(request.query);
        const result = await aniversarianteService.listarAniversariantes(mes);
        return reply.status(200).send(result);
    },
};
