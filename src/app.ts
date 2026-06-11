import fastifyCors from "@fastify/cors";
import Fastify, { FastifyInstance } from "fastify";
import { logger } from "./config/logger.js";
import { globalErrorHandler } from "./errors/errorHandler.js";
import routes from "./routes/index.js";

export async function createApp(): Promise<FastifyInstance> {
  try {
    const app = Fastify({
      loggerInstance: logger as any,
      disableRequestLogging: true,
    }) as FastifyInstance;

    // Logs de requisição simplificados (estilo Morgan)
    app.addHook("onResponse", (request, reply, done) => {
      if (request.method === "OPTIONS") return done();
      request.log.info(`${request.method} ${request.url} - ${reply.statusCode}`);
      done();
    });

    // HACK: Evita erro de 'Unsupported Media Type' no ambiente Vercel/Serverless para requisições sem corpo
    app.addHook("onRequest", (request, reply, done) => {
      if (!request.headers["content-type"]) {
        // Força application/json para requisições POST/PUT sem payload evitarem o erro Unsupported Media Type
        request.headers["content-type"] = "application/json";
      }
      
      const methodsWithoutBody = ["GET", "DELETE", "HEAD", "OPTIONS"];
      if (methodsWithoutBody.includes(request.method.toUpperCase())) {
        delete request.headers["content-length"];
        delete request.headers["transfer-encoding"];
      }
      
      done();
    });

    // Global Error Handler
    app.setErrorHandler(globalErrorHandler);

    // Configuração de CORS
    const envOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : [];

    const defaultOrigins = [
      "http://localhost:5173",
      "http://localhost:8080",
      "https://embu-express.vercel.app",
      "https://dev-embu-express.vercel.app",
      "https://localhost",
      "capacitor://localhost",
      "http://localhost"
    ];

    const allowedOrigins = Array.from(new Set([...envOrigins, ...defaultOrigins]));

    await app.register(fastifyCors, {
      origin: (origin, callback) => {
        // Permitir requisições sem origin (mobile apps, Postman, etc)
        if (!origin) return callback(null, true);

        // Verificar se a origin está na lista de permitidas ou se "*" foi definido
        if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          callback(null, true);
        } else {
          // Em produção, rejeitar origens não permitidas
          if (process.env.NODE_ENV === "production") {
            callback(new Error("Not allowed by CORS"), false);
          } else {
            // Em desenvolvimento, permitir qualquer origem
            callback(null, true);
          }
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    });

    // Registrar rotas
    await app.register(routes);

    await app.ready();

    return app;
  } catch (error) {
    console.error("[createApp] Erro ao criar aplicação Fastify:", error);
    throw error;
  }
}

// Export default to satisfy Vercel builder if it mistakenly treats this as an entry point
export default async function (req: any, res: any) {
  const app = await createApp();
  await app.ready();
  app.server.emit('request', req, res);
}

