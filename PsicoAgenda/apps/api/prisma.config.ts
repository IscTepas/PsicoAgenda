// Configuración de Prisma CLI para Prisma 7.
// El datasource (url) se define aquí; `env()` no se auto-carga desde .env en Prisma 7.
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

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
