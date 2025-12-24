import { FastifyInstance, FastifyPluginAsync } from "fastify";
import clientRoutes from "./client.routes.js";
import configuracaoRoutes from "./configuracao.routes.js";
import perfilRoutes from "./perfil.routes.js";
import pontoRoutes from "./ponto.routes.js";
import usuarioRoute from "./usuario.route.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Embu Express Routes
  app.register(usuarioRoute, { prefix: "/api/usuarios" });
  app.register(clientRoutes, { prefix: "/api/clientes" });
  app.register(perfilRoutes, { prefix: "/api/perfis" });
  app.register(pontoRoutes, { prefix: "/api/pontos" });
  app.register(configuracaoRoutes, { prefix: "/api/configuracoes" });

  // Van360 Legacy Routes (DISABLED TO FIX BUILD)

};

export default routes;
