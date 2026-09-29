import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "@/config";
import { PrismaClient } from "@/generated/prisma/client";

// Prisma 7 requiere un driver adapter explícito. Usamos PrismaPg (node-postgres).
//
// Se pasa un `pg.PoolConfig` y no una string por tres razones:
//  1. El default de `pg` es `ssl: false`: sin configuración explícita la conexión va
//     en texto plano, lo que incumple el requisito de cifrado en tránsito.
//  2. `pg-connection-string` trata `sslmode=prefer|require|verify-ca` como alias de
//     `verify-full`, que valida el certificado contra el almacén del sistema. La cadena
//     de Supabase no está firmada por una CA pública y eso falla con
//     `SELF_SIGNED_CERT_IN_CHAIN`; el valor que desactiva la verificación en este driver
//     es `sslmode=no-verify`, que no es un parámetro de libpq.
//  3. Si la string contiene `sslcert`, `sslkey`, `sslrootcert` o `sslmode`, el objeto
//     `ssl` de este config se sobrescribe al parsear (documentado en node-postgres).
//
// Endurecimiento pendiente: `rejectUnauthorized: true` con el `root.crt` que Supabase
// publica en el dashboard. La validación de identidad del servidor se delega por ahora
// a la cadena TLS del proveedor, que es un riesgo aceptado de la plataforma.
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: config.databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: config.databasePoolMax,
    }),
    log: config.isProduction ? ["error"] : ["warn", "error"],
  });

// Singleton: evita abrir un pool de conexiones nuevo en cada recarga de hot-reload.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}

/**
 * Cierra el pool de conexiones de forma ordenada. Sin esto, `SIGINT`/`SIGTERM`
 * deja procesos zombie con conexiones abiertas contra la base de datos.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
