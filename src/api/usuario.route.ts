import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { supabaseAdmin } from "../config/supabase.js";
import { usuarioService } from "../services/usuario.service.js";

const usuarioRoute: FastifyPluginAsync = async (app: FastifyInstance) => {
    app.post("/", async (request: any, reply) => {
        const data = request.body as any;
        try {
            const result = await usuarioService.createUsuario(data);
            return reply.status(201).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.put("/:id", async (request: any, reply) => {
        const id = request.params["id"] as string;
        const data = request.body as any;
        try {
            const result = await usuarioService.updateUsuario(id, data);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.get("/:id", async (request: any, reply) => {
        const id = request.params["id"] as string;
        try {
            const result = await usuarioService.getUsuario(id);
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(404).send({ error: err.message });
        }
    });

    app.get("/", async (request: any, reply) => {
        const { searchTerm, perfil_id, cliente_id, ativo } = request.query;
        try {
            const result = await usuarioService.listUsuarios({
                search: searchTerm,
                perfil_id, 
                cliente_id,
                ativo
            });
            return reply.status(200).send(result);
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });

    app.delete("/:id", async (request: any, reply) => {
        const id = request.params["id"] as string;
        
        // Security check: Prevent self-deletion
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (token) {
            const { data: { user } } = await supabaseAdmin.auth.getUser(token);
            if (user && user.id === id) {
                 return reply.status(400).send({ error: "Você não pode excluir seu próprio usuário." });
            }
        }

        try {
            await usuarioService.deleteUsuario(id);
            return reply.status(200).send({ success: true });
        } catch (err: any) {
            return reply.status(400).send({ error: err.message });
        }
    });
};

export default usuarioRoute;