import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Contrato de `POST /api/internal/despachar` de punta a punta (ruta + middleware):
 * es lo que llama el cron externo, así que sus cuatro respuestas son la interfaz.
 */
const { despacharPendientes, limpiarCacheRegistroVencida } = vi.hoisted(() => ({
  despacharPendientes: vi.fn(),
  limpiarCacheRegistroVencida: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {}, disconnectPrisma: vi.fn() }));
vi.mock("@/services/notification.service", () => ({ despacharPendientes }));
vi.mock("@/services/codigo-cache.repo", () => ({ limpiarCacheRegistroVencida }));

const appCon = async (secreto: string) => {
  vi.resetModules();
  vi.stubEnv("CRON_SECRET", secreto);
  const { createApp } = await import("@/create-app");
  return createApp();
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("POST /api/internal/despachar", () => {
  it("sin secreto configurado responde 503 y no barre", async () => {
    const res = await request(await appCon("")).post("/api/internal/despachar");
    expect(res.status).toBe(503);
    expect(despacharPendientes).not.toHaveBeenCalled();
  });

  it("sin credencial responde 401", async () => {
    const res = await request(await appCon("s3creto")).post("/api/internal/despachar");
    expect(res.status).toBe(401);
    expect(despacharPendientes).not.toHaveBeenCalled();
  });

  it("con credencial inválida responde 401", async () => {
    const res = await request(await appCon("s3creto"))
      .post("/api/internal/despachar")
      .set("Authorization", "Bearer otro");
    expect(res.status).toBe(401);
    expect(despacharPendientes).not.toHaveBeenCalled();
  });

  it("con la credencial correcta barre y responde { procesadas, vencidas }", async () => {
    despacharPendientes.mockResolvedValue(3);
    limpiarCacheRegistroVencida.mockResolvedValue(2);

    const res = await request(await appCon("s3creto"))
      .post("/api/internal/despachar")
      .set("Authorization", "Bearer s3creto");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, procesadas: 3, vencidas: 2 });
  });
});
