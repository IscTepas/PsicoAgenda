import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "@/app";

const app = createApp();

interface HealthBody {
  status: string;
  service: string;
  timestamp: string;
}

interface ErrorBody {
  error: { code: string; message: string };
}

describe("GET /api/health", () => {
  it("responde 200 con el estado del servicio", async () => {
    const response = await request(app).get("/api/health");
    const body = response.body as HealthBody;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "ok", service: "psicoagenda-api" });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
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
