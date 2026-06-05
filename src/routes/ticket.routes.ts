import { FastifyInstance, FastifyPluginAsync } from "fastify";
import { PERMISSIONS } from "../constants/permissions.enum.js";
import { verifyPermissao } from "../middlewares/auth.middleware.js";
import { TicketController } from "../controllers/ticket.controller.js";

const ticketRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/", { preHandler: [verifyPermissao(PERMISSIONS.CHAMADOS.VER)] }, TicketController.list);
  app.get("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CHAMADOS.VER)] }, TicketController.get);
  app.post("/", { preHandler: [verifyPermissao(PERMISSIONS.CHAMADOS.CRIAR)] }, TicketController.create);
  app.put("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CHAMADOS.CRIAR)] }, TicketController.update);
  app.delete("/:id", { preHandler: [verifyPermissao(PERMISSIONS.CHAMADOS.DELETAR)] }, TicketController.delete);

  app.get("/:id/comentarios", { preHandler: [verifyPermissao(PERMISSIONS.CHAMADOS.VER)] }, TicketController.listComments);
  app.post("/:id/comentarios", { preHandler: [verifyPermissao(PERMISSIONS.CHAMADOS.CRIAR)] }, TicketController.createComment);
};

export default ticketRoutes;
