import { z } from "zod";

export const ativMobEventFormItemSchema = z.object({
  type: z.number().optional(),
  label: z.string().optional(),
  url: z.string().optional(),
});

export const ativMobEventItemSchema = z.object({
  storeCNPJ: z.string().optional().nullable(),
  event_id: z.number().optional().nullable(),
  event_code: z.string().optional().nullable(),
  event_title: z.string().optional().nullable(),
  event_dth: z.string().optional().nullable(),
  order_number: z.string().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  agent_code: z.string().optional().nullable(),
  agent_name: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  codigo_roteiro: z.string().optional().nullable(),
  form: z.array(ativMobEventFormItemSchema).optional().default([]),
});

export const ativMobWebhookPayloadSchema = z.object({
  events: z.array(ativMobEventItemSchema).default([]),
  resultCode: z.number().optional().default(0),
  resultMsg: z.string().optional().default("OK"),
});

export type AtivMobEventItem = z.infer<typeof ativMobEventItemSchema>;
export type AtivMobWebhookPayload = z.infer<typeof ativMobWebhookPayloadSchema>;
export type AtivMobEventFormItem = z.infer<typeof ativMobEventFormItemSchema>;
