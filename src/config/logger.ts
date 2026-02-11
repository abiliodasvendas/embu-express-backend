import pino from "pino";
import { env } from "./env.js";

// Usar pino-pretty em desenvolvimento para logs formatados
const isDevelopment = env.NODE_ENV !== 'production';

// Configuração base do logger
const baseConfig: pino.LoggerOptions = {
  level: env.LOG_LEVEL || "info",
  
  // Redação de dados sensíveis para logs
  redact: {
    paths: [
      "email", 
      "password", 
      "senha", 
      "cpf", 
      "authorization", 
      "Authorization", 
      "headers.authorization",
      "access_token",
      "refresh_token",
      "*.password",
      "*.senha"
    ],
    remove: true
  },
};

function getLoggerConfig(): pino.LoggerOptions {
  if (isDevelopment) {
    // DESENVOLVIMENTO: Pretty print
    return {
      ...baseConfig,
      transport: {
        target: 'pino-pretty',
        options: { 
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname'
        }
      }
    };
  }

  // FALLBACK: JSON puro
  return {
    ...baseConfig,
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
  };
}

const loggerConfig = getLoggerConfig();

// Criar instância estável
const logger = pino(loggerConfig);

// Exportar tanto a instância quanto a configuração
export { logger, loggerConfig };
