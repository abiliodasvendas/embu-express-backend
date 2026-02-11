import { FastifyInstance, FastifyPluginAsync } from "fastify";
import authRoutes from "./auth.routes.js";
import clientRoutes from "./client.routes.js";
import configuracaoRoutes from "./configuracao.routes.js";
import empresaRoutes from "./empresa.routes.js";
import perfilRoutes from "./perfil.routes.js";
import pontoRoutes from "./ponto.routes.js";
import usuarioRoutes from "./usuario.routes.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Embu Express Routes
  app.register(authRoutes, { prefix: "/auth" });
  app.register(clientRoutes, { prefix: "/clientes" });
  app.register(configuracaoRoutes, { prefix: "/configuracoes" });
  app.register(empresaRoutes, { prefix: "/empresas" });
  app.register(perfilRoutes, { prefix: "/perfis" });
  app.register(pontoRoutes, { prefix: "/pontos" });
  app.register(usuarioRoutes, { prefix: "/usuarios" });

};

export default routes;
