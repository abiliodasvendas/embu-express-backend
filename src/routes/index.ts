import { FastifyInstance, FastifyPluginAsync } from "fastify";
import appUpdatesRoutes from "./app_updates.routes.js";
import authRoutes from "./auth.routes.js";
import clientRoutes from "./client.routes.js";
import configuracaoRoutes from "./configuracao.routes.js";
import empresaRoutes from "./empresa.routes.js";
import perfilRoutes from "./perfil.routes.js";
import pontoRoutes from "./ponto.routes.js";
import usuarioRoutes from "./usuario.routes.js";
import ocorrenciaRoutes from "./ocorrencia.routes.js";
import financeiroRoutes from "./financeiro.routes.js";
import publicClientRoutes from "./public-client.routes.js";
import feriadoRoutes from "./feriado.routes.js";
import { unidadeRoutes } from "./unidade.routes.js";

const routes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Embu Express Routes
  app.register(appUpdatesRoutes, { prefix: "/api/app" });
  app.register(authRoutes, { prefix: "/api/auth" });
  app.register(clientRoutes, { prefix: "/api/clientes" });
  app.register(configuracaoRoutes, { prefix: "/api/configuracoes" });
  app.register(empresaRoutes, { prefix: "/api/empresas" });
  app.register(perfilRoutes, { prefix: "/api/perfis" });
  app.register(pontoRoutes, { prefix: "/api/pontos" });
  app.register(usuarioRoutes, { prefix: "/api/usuarios" });
  app.register(ocorrenciaRoutes, { prefix: "/api/ocorrencias" });
  app.register(financeiroRoutes, { prefix: "/api/financeiro" });
  app.register(publicClientRoutes, { prefix: "/api/public/c" });
  app.register(feriadoRoutes, { prefix: "/api/feriados" });
  app.register(unidadeRoutes, { prefix: "/api/unidades" });
};

export default routes;
