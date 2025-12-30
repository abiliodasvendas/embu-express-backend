import { FastifyInstance, FastifyPluginAsync } from "fastify";
import clientRoutes from "./client.routes.js";
import configuracaoRoutes from "./configuracao.routes.js";
import empresaRoutes from "./empresa.routes.js";
import perfilRoutes from "./perfil.routes.js";
import pontoRoutes from "./ponto.routes.js";
import usuarioRoutes from "./usuario.routes.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Embu Express Routes
  app.register(clientRoutes, { prefix: "/api/clientes" });
  app.register(configuracaoRoutes, { prefix: "/api/configuracoes" });
  app.register(empresaRoutes, { prefix: "/api/empresas" });
  app.register(perfilRoutes, { prefix: "/api/perfis" });
  app.register(pontoRoutes, { prefix: "/api/pontos" });
  app.register(usuarioRoutes, { prefix: "/api/usuarios" });

  // Van360 Legacy Routes (DISABLED TO FIX BUILD)

};

export default routes;
