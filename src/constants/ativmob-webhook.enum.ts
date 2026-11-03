export enum AtivMobWebhookStatus {
  RECEIVED = "RECEIVED",
  PROCESSED = "PROCESSED",
  IGNORED = "IGNORED",
  ERROR = "ERROR",
}

export const ATIVMOB_ROUTES = {
  WEBHOOK: "/api/webhooks/ativmob",
} as const;
