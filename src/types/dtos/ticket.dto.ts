import { Ticket, TicketComment } from "../database.js";
import { TicketType, TicketStatus, TicketPriority } from "../../constants/ticket.enum.js";

export interface TicketDTO {
  id: string;
  title: string;
  description: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  author_id: string;
  attachments: string[];
  created_at?: string;
  updated_at?: string;
  author?: {
    id: string;
    nome_completo: string;
  };
}

export interface TicketCommentDTO {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  created_at?: string;
  author?: {
    id: string;
    nome_completo: string;
  };
}

export function toTicketDTO(t: Ticket): TicketDTO {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    type: t.type,
    status: t.status,
    priority: t.priority,
    author_id: t.author_id,
    attachments: t.attachments || [],
    created_at: t.created_at,
    updated_at: t.updated_at,
    author: t.author
  };
}

export function toTicketListDTO(tickets: Ticket[]): TicketDTO[] {
  return tickets.map(toTicketDTO);
}

export function toTicketCommentDTO(c: TicketComment): TicketCommentDTO {
  return {
    id: c.id,
    ticket_id: c.ticket_id,
    author_id: c.author_id,
    content: c.content,
    created_at: c.created_at,
    author: c.author
  };
}

export function toTicketCommentListDTO(comments: TicketComment[]): TicketCommentDTO[] {
  return comments.map(toTicketCommentDTO);
}
