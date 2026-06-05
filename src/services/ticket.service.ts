import { supabaseAdmin } from "../config/supabase.js";
import { Ticket, TicketComment } from "../types/database.js";
import { z } from "zod";
import { ticketSchema, updateTicketSchema, commentSchema } from "../schemas/ticket.schema.js";
import { AppError } from "../errors/AppError.js";
import { messages } from "../constants/messages.js";
import { toBRTime } from "../utils/utils.js";

type TicketPayload = z.infer<typeof ticketSchema>;
type UpdateTicketPayload = z.infer<typeof updateTicketSchema>;
type CommentPayload = z.infer<typeof commentSchema>;

function formatDates<T extends { created_at?: string; updated_at?: string }>(item: T): T {
  if (!item) return item;
  const result = { ...item };
  if (result.created_at) result.created_at = toBRTime(result.created_at);
  if (result.updated_at) result.updated_at = toBRTime(result.updated_at);
  return result;
}

export const ticketService = {
  async listTickets(): Promise<Ticket[]> {
    const { data, error } = await supabaseAdmin
      .from("tickets")
      .select(`
        *,
        author:usuarios!fk_tickets_author(id, nome_completo)
      `)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(formatDates);
  },

  async getTicketById(id: string): Promise<Ticket> {
    const { data, error } = await supabaseAdmin
      .from("tickets")
      .select(`
        *,
        author:usuarios!fk_tickets_author(id, nome_completo)
      `)
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new AppError("Chamado não encontrado", 404);
    }
    return formatDates(data);
  },

  async createTicket(data: TicketPayload & { author_id: string }): Promise<Ticket> {
    const { data: inserted, error } = await supabaseAdmin
      .from("tickets")
      .insert([data])
      .select(`
        *,
        author:usuarios!fk_tickets_author(id, nome_completo)
      `)
      .single();

    if (error) throw error;
    return formatDates(inserted);
  },

  async updateTicket(id: string, data: Partial<UpdateTicketPayload>): Promise<Ticket> {
    const { data: updated, error } = await supabaseAdmin
      .from("tickets")
      .update(data)
      .eq("id", id)
      .select(`
        *,
        author:usuarios!fk_tickets_author(id, nome_completo)
      `)
      .single();

    if (error) throw error;
    return formatDates(updated);
  },

  async deleteTicket(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("tickets")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async listComments(ticketId: string): Promise<TicketComment[]> {
    const { data, error } = await supabaseAdmin
      .from("ticket_comments")
      .select(`
        *,
        author:usuarios!fk_comments_author(id, nome_completo)
      `)
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []).map(formatDates);
  },

  async createComment(ticketId: string, authorId: string, data: CommentPayload): Promise<TicketComment> {
    const { data: inserted, error } = await supabaseAdmin
      .from("ticket_comments")
      .insert([{ ticket_id: ticketId, author_id: authorId, content: data.content }])
      .select(`
        *,
        author:usuarios!fk_comments_author(id, nome_completo)
      `)
      .single();

    if (error) throw error;
    return formatDates(inserted);
  }
};
