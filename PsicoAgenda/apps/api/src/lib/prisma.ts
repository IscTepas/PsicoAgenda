import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "@/config";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 requiere un driver adapter explícito. Usamos PrismaPg (node-postgres).
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
    log: config.isProduction ? ["error"] : ["warn", "error"],
  });

// Singleton: evita abrir un pool de conexiones nuevo en cada recarga de hot-reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}
