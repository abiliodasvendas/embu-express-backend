import { FastifyInstance } from "fastify";
import { convenioController } from "../controllers/convenio.controller.js";
import { convenioAuditoriaController } from "../controllers/convenio-auditoria.controller.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { PERMISSIONS } from "../constants/permissions.enum.js";

export async function convenioRoutes(fastify: FastifyInstance) {
    // --------------------------------------------------
    // ROTAS PÚBLICAS (PARCEIRO VIA LINK/TOKEN)
    // --------------------------------------------------
    fastify.get("/public/:token", convenioController.getPublicInfo);
    fastify.get("/public/:token/colaboradores", convenioController.listColaboradoresPublic);
    fastify.get("/public/:token/colaboradores/:colaboradorId/elegibilidade", convenioController.checkElegibilidadePublic);
    fastify.get("/public/:token/lancamentos", convenioController.listLancamentosMes);
    fastify.post("/public/:token/lancamentos", convenioController.createLancamento);
    fastify.put("/public/:token/lancamentos/:id", convenioController.updateLancamento);
    fastify.delete("/public/:token/lancamentos/:id", convenioController.deleteLancamento);

    // --------------------------------------------------
    // ROTAS ADMINISTRATIVAS (EMBU EXPRESS)
    // --------------------------------------------------
    fastify.register(async function (protectedRoutes) {
        protectedRoutes.get("/", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.VER)] }, convenioController.list);
        protectedRoutes.get("/resumo-geral", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.VER)] }, convenioAuditoriaController.getResumoGeral);
        protectedRoutes.get("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.VER)] }, convenioController.get);
        protectedRoutes.get("/:id/lancamentos", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.VER)] }, convenioController.listLancamentos);
        protectedRoutes.get("/:id/auditoria", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.VER)] }, convenioAuditoriaController.getAuditoria);
        protectedRoutes.post("/", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.EDITAR)] }, convenioController.create);
        protectedRoutes.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.EDITAR)] }, convenioController.update);
        protectedRoutes.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.EDITAR)] }, convenioController.delete);
        protectedRoutes.post("/:id/lancamentos", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.EDITAR)] }, convenioController.createLancamentoAdmin);
        protectedRoutes.put("/:id/lancamentos/:lancamentoId", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.EDITAR)] }, convenioController.updateLancamentoAdmin);
        protectedRoutes.delete("/:id/lancamentos/:lancamentoId", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.EDITAR)] }, convenioController.deleteLancamentoAdmin);
        protectedRoutes.post("/:id/fatura-fornecedor", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.EDITAR)] }, convenioAuditoriaController.salvarFatura);
        protectedRoutes.patch("/:id/fatura-fornecedor/:faturaId/status", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.EDITAR)] }, convenioAuditoriaController.atualizarStatus);

        // Bloqueios de Convênios
        protectedRoutes.get("/bloqueios", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.VER)] }, convenioController.listAllBloqueios);
        protectedRoutes.get("/colaboradores/:colaboradorId/bloqueios", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.VER)] }, convenioController.getBloqueiosColaborador);
        protectedRoutes.put("/colaboradores/:colaboradorId/bloqueios", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.EDITAR)] }, convenioController.salvarBloqueiosColaborador);
        protectedRoutes.get("/colaboradores/:colaboradorId/elegibilidade/:convenioId", { preHandler: [verifyPermissao(PERMISSIONS.CONVENIOS.VER)] }, convenioController.checkElegibilidade);
    });
}
