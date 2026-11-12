import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Contrato de `POST /api/internal/mantenimiento`: es lo que dispara
 * `cron-job.org`, así que sus cuatro respuestas son la interfaz.
 */
const { purgarDatosVencidos, despacharPendientes, limpiarCacheRegistroVencida } = vi.hoisted(() => ({
  purgarDatosVencidos: vi.fn(),
  despacharPendientes: vi.fn(),
  limpiarCacheRegistroVencida: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {}, disconnectPrisma: vi.fn() }));
vi.mock("@/services/mantenimiento.service", () => ({ purgarDatosVencidos }));
vi.mock("@/services/notification.service", () => ({ despacharPendientes }));
vi.mock("@/services/codigo-cache.repo", () => ({ limpiarCacheRegistroVencida }));

const appCon = async (secreto: string) => {
  vi.resetModules();
  vi.stubEnv("CRON_SECRET", secreto);
  const { createApp } = await import("@/create-app");
  return createApp();
};

const resultado = {
  eliminadas: { notificaciones: 12, solicitudes_cita: 3, cache_registro: 4 },
  solicitudesExpiradas: 2,
  tamanoBaseBytes: 14_680_064,
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/internal/mantenimiento", () => {
  it("sin secreto configurado responde 503 y no purga", async () => {
    const res = await request(await appCon("")).post("/api/internal/mantenimiento");
    expect(res.status).toBe(503);
    expect(purgarDatosVencidos).not.toHaveBeenCalled();
  });

  it("sin credencial responde 401 y no purga", async () => {
    const res = await request(await appCon("s3creto")).post("/api/internal/mantenimiento");
    expect(res.status).toBe(401);
    expect(purgarDatosVencidos).not.toHaveBeenCalled();
  });

  it("con credencial inválida responde 401 y no purga", async () => {
    const res = await request(await appCon("s3creto"))
      .post("/api/internal/mantenimiento")
      .set("Authorization", "Bearer otro");
    expect(res.status).toBe(401);
    expect(purgarDatosVencidos).not.toHaveBeenCalled();
  });

  it("con la credencial correcta informa filas eliminadas por tabla y tamaño de la base", async () => {
    purgarDatosVencidos.mockResolvedValue(resultado);

    const res = await request(await appCon("s3creto"))
      .post("/api/internal/mantenimiento")
      .set("Authorization", "Bearer s3creto");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      eliminadas: { notificaciones: 12, solicitudes_cita: 3, cache_registro: 4 },
      solicitudesExpiradas: 2,
      tamanoBaseBytes: 14_680_064,
    });
    const body = res.body as { ejecutadoEn?: unknown };
    expect(typeof body.ejecutadoEn).toBe("string");
    expect(purgarDatosVencidos).toHaveBeenCalledTimes(1);
  });
});
