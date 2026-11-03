import { AtivMobWebhookStatus } from "../../constants/ativmob-webhook.enum.js";
import { AtivMobWebhookEvent } from "../database.js";

export interface AtivMobWebhookResponseDTO {
  resultCode: number;
  resultMsg: string;
  received: boolean;
  events_count: number;
}

export interface AtivMobWebhookEventDTO {
  id: string;
  eventId: number | null;
  eventCode: string | null;
  eventTitle: string | null;
  eventDth: string | null;
  storeCnpj: string | null;
  orderNumber: string | null;
  invoiceNumber: string | null;
  agentCode: string | null;
  agentName: string | null;
  lat: number | null;
  lng: number | null;
  codigoRoteiro: string | null;
  status: AtivMobWebhookStatus;
  createdAt: string;
}

export function toAtivMobWebhookEventDTO(event: AtivMobWebhookEvent): AtivMobWebhookEventDTO {
  return {
    id: event.id,
    eventId: event.event_id,
    eventCode: event.event_code,
    eventTitle: event.event_title,
    eventDth: event.event_dth,
    storeCnpj: event.store_cnpj,
    orderNumber: event.order_number,
    invoiceNumber: event.invoice_number,
    agentCode: event.agent_code,
    agentName: event.agent_name,
    lat: event.lat,
    lng: event.lng,
    codigoRoteiro: event.codigo_roteiro,
    status: event.status as AtivMobWebhookStatus,
    createdAt: event.created_at,
  };
}
