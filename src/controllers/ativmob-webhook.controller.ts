import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ativMobWebhookRepository } from "../repositories/ativmob-webhook.repository.js";
import { ativMobWebhookPayloadSchema } from "../schemas/ativmob-webhook.schema.js";
import { ativMobWebhookService } from "../services/ativmob-webhook.service.js";
import { toAtivMobWebhookEventDTO } from "../types/dtos/ativmob-webhook.dto.js";

function extractToken(request: FastifyRequest): string | undefined {
  const query = request.query as Record<string, string | undefined>;
  const queryToken = query?.token;
  if (queryToken) return queryToken;

  const headerToken = request.headers["x-webhook-token"];
  if (typeof headerToken === "string") return headerToken;

  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  return undefined;
}

export const ativMobWebhookController = {
  async handle(request: FastifyRequest, reply: FastifyReply) {
    if (env.ATIVMOB_WEBHOOK_SECRET) {
      const token = extractToken(request);
      if (token !== env.ATIVMOB_WEBHOOK_SECRET) {
        logger.warn("[AtivMobWebhookController] Requisição de webhook rejeitada: token inválido");
        return reply.status(401).send({
          resultCode: 1,
          resultMsg: "Unauthorized",
          received: false,
        });
      }
    }

    const payload = ativMobWebhookPayloadSchema.parse(request.body);
    const result = await ativMobWebhookService.processWebhook(payload);

    return reply.status(200).send(result);
  },

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = z
      .object({
        limit: z.coerce.number().min(1).max(200).optional().default(50),
      })
      .parse(request.query);

    const events = await ativMobWebhookRepository.listRecent(query.limit);
    return reply.status(200).send(events.map(toAtivMobWebhookEventDTO));
  },
};
