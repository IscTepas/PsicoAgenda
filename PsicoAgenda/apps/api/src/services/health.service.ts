import { prisma } from "@/lib/prisma";

export interface HealthStatus {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
  database: "up" | "down";
  databaseError?: string;
}

/**
 * Estado de salud del servicio con una comprobación real de la base de datos.
 *
 * La consulta es la más barata posible (`SELECT 1`): el objetivo es verificar que el
 * pool abre conexiones y que el canal cifrado negocia, no validar el esquema.
 * Ante cualquier fallo se degrada a 503 en lugar de reportar "ok" sin persistencia.
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const base = {
    service: "psicoagenda-api",
    timestamp: new Date().toISOString(),
  } as const;

  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ...base, status: "ok", database: "up" };
  } catch (error) {
    return {
      ...base,
      status: "degraded",
      database: "down",
      databaseError: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
