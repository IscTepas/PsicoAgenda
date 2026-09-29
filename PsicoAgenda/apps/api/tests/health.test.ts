import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Estrategia de pruebas de servicios: se sustituye `@/lib/prisma` por un doble con
 * `vi.mock`. La suite completa se ejecuta sin conexión a la base de datos ni a
 * Supabase; la integración contra una base real queda para un proyecto dedicado.
 */
const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRaw },
  disconnectPrisma: vi.fn(),
}));

const { createApp } = await import("@/app");

const app = createApp();

interface HealthBody {
  status: string;
  service: string;
  timestamp: string;
  database: string;
  databaseError?: string;
}

interface ErrorBody {
  error: { code: string; message: string };
}

beforeEach(() => {
  queryRaw.mockReset();
  queryRaw.mockResolvedValue([{ "1": 1 }]);
});

describe("GET /api/health", () => {
  it("responde 200 cuando la base de datos responde", async () => {
    const response = await request(app).get("/api/health");
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", service: "psicoagenda-api", database: "up" });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
  });

  it("responde 503 cuando la consulta a la base de datos falla", async () => {
    queryRaw.mockRejectedValue(new Error("SELF_SIGNED_CERT_IN_CHAIN"));

    const response = await request(app).get("/api/health");
    const body = response.body as HealthBody;

    expect(response.status).toBe(503);
    expect(body).toMatchObject({ status: "degraded", database: "down" });
    expect(body.databaseError).toContain("SELF_SIGNED_CERT_IN_CHAIN");
  });
});

describe("enrutado de la API", () => {
  it("devuelve 404 con código de error cuando la ruta no existe", async () => {
    const response = await request(app).get("/api/no-existe");
    const body = response.body as ErrorBody;

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
