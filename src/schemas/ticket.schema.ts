import { z } from "zod";
import { TicketType, TicketStatus, TicketPriority } from "../constants/ticket.enum.js";

export const ticketSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres").max(255),
  description: z.string().min(5, "Descrição deve ter pelo menos 5 caracteres"),
  type: z.nativeEnum(TicketType),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
  attachments: z.array(z.string().url("URL de anexo inválida")).default([]),
});

export const updateTicketSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().min(5).optional(),
  type: z.nativeEnum(TicketType).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  attachments: z.array(z.string().url()).optional(),
});

export const commentSchema = z.object({
  content: z.string().min(1, "O conteúdo do comentário não pode estar vazio"),
});
