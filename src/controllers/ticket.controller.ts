import { FastifyReply, FastifyRequest } from "fastify";
import { ticketService } from "../services/ticket.service.js";
import { ticketSchema, updateTicketSchema, commentSchema } from "../schemas/ticket.schema.js";
import { toTicketDTO, toTicketListDTO, toTicketCommentDTO, toTicketCommentListDTO } from "../types/dtos/ticket.dto.js";
import { AuthenticatedRequest } from "../types/request.type.js";
import { ROLES } from "../constants/permissions.enum.js";
import { AppError } from "../errors/AppError.js";
import { messages } from "../constants/messages.js";
import { z } from "zod";

export const TicketController = {
  async list(request: AuthenticatedRequest, reply: FastifyReply) {
    const result = await ticketService.listTickets();
    return reply.send(toTicketListDTO(result));
  },

  async get(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await ticketService.getTicketById(id);
    return reply.send(toTicketDTO(result));
  },

  async create(request: AuthenticatedRequest, reply: FastifyReply) {
    const data = ticketSchema.parse(request.body);
    const userId = request.user?.id;
    if (!userId) {
      throw new AppError(messages.auth.erro.tokenInvalido, 401);
    }
    const result = await ticketService.createTicket({
      ...data,
      author_id: userId
    });
    return reply.status(201).send(toTicketDTO(result));
  },

  async update(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = updateTicketSchema.parse(request.body);
    
    const profileName = request.user_profile?.perfil?.nome;
    const isAdmin = profileName === ROLES.SUPER_ADMIN || profileName === ROLES.ADMIN;

    if (data.status && !isAdmin) {
      throw new AppError(messages.sistema.erro.naoAutorizado, 403);
    }

    const result = await ticketService.updateTicket(id, data);
    return reply.send(toTicketDTO(result));
  },

  async delete(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    
    const profileName = request.user_profile?.perfil?.nome;
    const isAdmin = profileName === ROLES.SUPER_ADMIN || profileName === ROLES.ADMIN;

    const ticket = await ticketService.getTicketById(id);
    const isAuthor = ticket.author_id === request.user?.id;

    if (!isAdmin && !isAuthor) {
      throw new AppError(messages.sistema.erro.naoAutorizado, 403);
    }

    await ticketService.deleteTicket(id);
    return reply.status(204).send();
  },

  async listComments(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id: ticketId } = z.object({ id: z.string().uuid() }).parse(request.params);
    const result = await ticketService.listComments(ticketId);
    return reply.send(toTicketCommentListDTO(result));
  },

  async createComment(request: AuthenticatedRequest, reply: FastifyReply) {
    const { id: ticketId } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = commentSchema.parse(request.body);
    const userId = request.user?.id;
    if (!userId) {
      throw new AppError(messages.auth.erro.tokenInvalido, 401);
    }
    const result = await ticketService.createComment(ticketId, userId, data);
    return reply.status(201).send(toTicketCommentDTO(result));
  }
};
