export const env = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || "development",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://localhost:8080,https://embu-express.vercel.app",
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
  LOGTAIL_TOKEN: process.env.LOGTAIL_TOKEN,
};