// Configuración de Prisma CLI para Prisma 7.
// El datasource (url) se define aquí; `env()` no se auto-carga desde .env en Prisma 7.
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
