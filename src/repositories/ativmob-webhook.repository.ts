import { supabaseAdmin } from "../config/supabase.js";
import { AtivMobWebhookEvent } from "../types/database.js";

export const ativMobWebhookRepository = {
  async upsertEvent(record: Record<string, unknown>): Promise<AtivMobWebhookEvent> {
    const { data, error } = await supabaseAdmin
      .from("ativmob_webhook_events")
      .upsert([record], {
        onConflict: "event_id,codigo_roteiro,order_number",
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from("ativmob_webhook_events")
        .insert([record])
        .select()
        .single();

      if (fallbackError) throw fallbackError;
      return fallbackData as AtivMobWebhookEvent;
    }

    return data as AtivMobWebhookEvent;
  },

  async insertRawEvent(record: Record<string, unknown>): Promise<AtivMobWebhookEvent> {
    const { data, error } = await supabaseAdmin
      .from("ativmob_webhook_events")
      .insert([record])
      .select()
      .single();

    if (error) throw error;
    return data as AtivMobWebhookEvent;
  },

  async listRecent(limit = 50): Promise<AtivMobWebhookEvent[]> {
    const { data, error } = await supabaseAdmin
      .from("ativmob_webhook_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []) as AtivMobWebhookEvent[];
  },
};
