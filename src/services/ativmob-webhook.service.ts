import { logger } from "../config/logger.js";
import { AtivMobWebhookStatus } from "../constants/ativmob-webhook.enum.js";
import { ativMobWebhookRepository } from "../repositories/ativmob-webhook.repository.js";
import { AtivMobWebhookPayload, AtivMobEventItem } from "../schemas/ativmob-webhook.schema.js";
import { AtivMobWebhookResponseDTO } from "../types/dtos/ativmob-webhook.dto.js";

function parseEventDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const isoFormatted = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
  const parsed = new Date(isoFormatted);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export const ativMobWebhookService = {
  async processWebhook(payload: AtivMobWebhookPayload): Promise<AtivMobWebhookResponseDTO> {
    const events = payload.events || [];
    logger.info({ eventCount: events.length }, "[AtivMobWebhookService] Processando lote de eventos da AtivMob");

    for (const event of events) {
      await this.processSingleEvent(event);
    }

    return {
      resultCode: 0,
      resultMsg: "OK",
      received: true,
      events_count: events.length,
    };
  },

  async processSingleEvent(event: AtivMobEventItem): Promise<void> {
    try {
      const record = {
        store_cnpj: event.storeCNPJ || null,
        event_id: event.event_id ?? null,
        event_code: event.event_code || null,
        event_title: event.event_title || null,
        event_dth: parseEventDate(event.event_dth),
        order_number: event.order_number || null,
        invoice_number: event.invoice_number || null,
        agent_code: event.agent_code || null,
        agent_name: event.agent_name || null,
        lat: event.lat ?? null,
        lng: event.lng ?? null,
        codigo_roteiro: event.codigo_roteiro || null,
        form: event.form || [],
        raw_payload: event as Record<string, unknown>,
        status: AtivMobWebhookStatus.RECEIVED,
        updated_at: new Date().toISOString(),
      };

      await ativMobWebhookRepository.upsertEvent(record);

      logger.info(
        {
          eventId: event.event_id,
          eventTitle: event.event_title,
          orderNumber: event.order_number,
          codigoRoteiro: event.codigo_roteiro,
        },
        "[AtivMobWebhookService] Evento AtivMob persistido com sucesso"
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(
        {
          error: msg,
          eventId: event.event_id,
          orderNumber: event.order_number,
        },
        "[AtivMobWebhookService] Erro ao persistir evento individual AtivMob"
      );
    }
  },
};
