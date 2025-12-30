import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { empresaService } from "../services/empresa.service.js";

const empresaRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // Listar empresas
    app.get("/", async (request: any, reply) => {
        try {
            const { searchTerm, ativo, includeId } = request.query as any;
            const empresas = await empresaService.listEmpresas({ searchTerm, ativo, includeId });
            return reply.status(200).send(empresas);
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    });

    // Obter empresa por ID
    app.get("/:id", async (request: any, reply) => {
        try {
            const id = parseInt(request.params["id"]);
            const empresa = await empresaService.getEmpresa(id);
            return reply.status(200).send(empresa);
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    });

    // Criar nova empresa
    app.post("/", async (request: any, reply) => {
        try {
            const novaEmpresa = await empresaService.createEmpresa(request.body);
            return reply.status(201).send(novaEmpresa);
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    });

    // Atualizar empresa
    app.put("/:id", async (request: any, reply) => {
        try {
            const id = parseInt(request.params["id"]);
            const atualizada = await empresaService.updateEmpresa(id, request.body);
            return reply.status(200).send(atualizada);
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    });

    // Toggle Status (Ativar/Desativar)
    app.patch("/:id/toggle-ativo", async (request: any, reply) => {
        try {
            const id = parseInt(request.params["id"]);
            const { novoStatus } = request.body as { novoStatus: boolean };
            
            if (novoStatus === undefined) {
                return reply.status(400).send({ error: "Status obrigatório" });
            }
            
            await empresaService.toggleAtivo(id, novoStatus);
            return reply.status(200).send({ success: true, ativo: novoStatus });
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    });

    // Deletar empresa
    app.delete("/:id", async (request: any, reply) => {
        try {
            const id = parseInt(request.params["id"]);
            await empresaService.deleteEmpresa(id);
            return reply.status(200).send({ message: "Empresa excluída com sucesso" });
        } catch (error: any) {
            return reply.status(500).send({ error: error.message });
        }
    });
};

export default empresaRoutes;
