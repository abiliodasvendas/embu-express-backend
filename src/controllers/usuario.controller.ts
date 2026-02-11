import { FastifyReply, FastifyRequest } from "fastify";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { usuarioService } from "../services/usuario.service.js";

export const UsuarioController = {
    async create(request: FastifyRequest, reply: FastifyReply) {
        const data = request.body as any;
        try {
            const result = await usuarioService.createUsuario(data);
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
        const id = (request.params as any).id as string;
        const data = request.body as any;
        try {
            const result = await usuarioService.updateUsuario(id, data);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    },

    async get(request: FastifyRequest, reply: FastifyReply) {
        const id = (request.params as any).id as string;
        try {
            const result = await usuarioService.getUsuario(id);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(404).send({ error: err.message });
        }
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
        const { searchTerm, perfil_id, cliente_id, status, empresa_id } = request.query as any;
        
        try {
            const result = await usuarioService.listUsuarios({
                searchTerm,
                perfil_id, 
                cliente_id,
                empresa_id,
                status // Pass status directly
            });
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    },

    async delete(request: FastifyRequest, reply: FastifyReply) {
        const id = (request.params as any).id as string;
        
        // Security check: Prevent self-deletion
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (token) {
            const { data: { user } } = await supabaseAdmin.auth.getUser(token);
            if (user && user.id === id) {
                 return reply.status(400).send({ error: messages.usuario.erro.autoExclusao });
            }
        }

        try {
            await usuarioService.deleteUsuario(id);
            return reply.status(200).send({ success: true });
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    },

    async updateStatus(request: FastifyRequest, reply: FastifyReply) {
        const id = (request.params as any).id as string;
        const { status } = request.body as { status: string };

        // Security check: Prevent self-deactivation if setting to INATIVO
        if (status === 'INATIVO') {
            const token = request.headers.authorization?.replace('Bearer ', '');
            if (token) {
                const { data: { user } } = await supabaseAdmin.auth.getUser(token);
                if (user && user.id === id) {
                    return reply.status(400).send({ error: messages.usuario.erro.autoDesativacao });
                }
            }
        }

        try {
            const result = await usuarioService.updateStatus(id, status);
            return reply.status(200).send({ status: result });
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    },

    // --- Vínculos (Turnos) ---

    async createVinculo(request: FastifyRequest, reply: FastifyReply) {
        const data = request.body as any;
        try {
            // Import dynamically to avoid circular dependency if any, though here it's fine.
            const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
            const result = await colaboradorClienteService.createLink(data);
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    },

    async updateVinculo(request: FastifyRequest, reply: FastifyReply) {
        const id = parseInt((request.params as any).id);
        const data = request.body as any;
        try {
            const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
            const result = await colaboradorClienteService.updateLink(id, data);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    },

    async deleteVinculo(request: FastifyRequest, reply: FastifyReply) {
        const id = parseInt((request.params as any).id);
        try {
            const { colaboradorClienteService } = await import("../services/colaborador-cliente.service.js");
            await colaboradorClienteService.deleteLink(id);
            return reply.status(200).send({ success: true });
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    }
};
