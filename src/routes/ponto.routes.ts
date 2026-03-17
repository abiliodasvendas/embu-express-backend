import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyOperacional, verifyPermissao } from "../middlewares/auth.middleware.js";
import { PontoController } from "../controllers/ponto.controller.js";

const pontoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
    // ADMIN: Inserção manual de ponto
    app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.PONTO.ADMIN_CRIAR)] }, PontoController.register);

    // OPERACIONAL: Motoboy batendo ponto
    app.post("/toggle", { preHandler: [verifyOperacional()] }, PontoController.toggle);

    // OPERACIONAL / ADMIN: Ver ponto de hoje (Usado pelo App para mostrar status)
    app.get("/hoje", { preHandler: [verifyOperacional()] }, PontoController.list); // listPontos already handles query params for hoje? Wait, no.
    
    // Actually the route /hoje was doing getPontoHoje(usuarioId) from query. 
    // And there is another /hoje/:usuarioId. 
    
    // I need to be careful with the mapping.
    
    app.get("/ultimo-km/:usuarioId", { preHandler: [verifyOperacional()] }, PontoController.getUltimoKm);
    
    // ADMIN: Editar ponto manualmente
    app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PONTO.ADMIN_EDITAR)] }, PontoController.update);

    // ADMIN: Deletar ponto
    app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.PONTO.ADMIN_DELETAR)] }, PontoController.delete);

    // ADMIN: Listar pontos
    app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.PONTO.ADMIN_VER)] }, PontoController.list);

    // ADMIN / PESSOAL: Ver detalhes de um ponto específico
    app.get("/:id", { preHandler: [verifyPermissao([PERMISSIONS.PONTO.ADMIN_VER, PERMISSIONS.PONTO.VER_MEU])] }, PontoController.getOne);

    // RELATÓRIOS
    app.get("/relatorio-mensal/:usuario_id", { preHandler: [verifyPermissao([PERMISSIONS.PONTO.ADMIN_VER, PERMISSIONS.PONTO.VER_MEU])] }, PontoController.relatorioMensal);

    // PAUSAS
    app.post("/pausa/inicio", { preHandler: [verifyOperacional()] }, PontoController.iniciarPausa);
    app.post("/pausa/fim", { preHandler: [verifyOperacional()] }, PontoController.finalizarPausa);
    app.post("/:id/pausas", { preHandler: [verifyOperacional()] }, PontoController.iniciarPausa);
    app.put("/pausas/:id", { preHandler: [verifyOperacional()] }, PontoController.finalizarPausa);

    // Fallback/Legacy compat for App
    app.get("/hoje/:usuarioId", { preHandler: [verifyOperacional()] }, PontoController.getHoje);
};

export default pontoRoutes;
