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
  /*
  import assinaturaCobrancaRoute from "./assinatura-cobranca.route.js";
  import cobrancaRoute from "./cobranca.routes.js";
  import escolaRoute from "./escola.routes.js";
  import gastoRoute from "./gasto.route.js";
  import interRoutes from "./inter.routes.js";
  import mockPagamentoRoute from "./mock-pagamento.routes.js";
  import passageiroRoute from "./passageiro.routes.js";
  import planoRoute from "./plano.routes.js";
  import prePassageiroRoute from "./pre-passageiro.routes.js";
  import veiculoRoute from "./veiculo.routes.js";
  import webhookInterRoute from "./webhook-inter.route.js";

  app.register(planoRoute, { prefix: "/api/planos" });
  app.register(interRoutes, { prefix: "/api/inter" });
  app.register(webhookInterRoute, { prefix: "/api/inter/webhook" });
  app.register(mockPagamentoRoute, { prefix: "/api" });
  app.register(cobrancaRoute, { prefix: "/api/cobrancas" });
  app.register(passageiroRoute, { prefix: "/api/passageiros" });
  app.register(prePassageiroRoute, { prefix: "/api/pre-passageiros" });
  app.register(veiculoRoute, { prefix: "/api/veiculos" });
  app.register(escolaRoute, { prefix: "/api/escolas" });
  app.register(gastoRoute, { prefix: "/api/gastos" });
  app.register(assinaturaCobrancaRoute, { prefix: "/api/assinatura-cobrancas" });
  */
};

export default routes;
