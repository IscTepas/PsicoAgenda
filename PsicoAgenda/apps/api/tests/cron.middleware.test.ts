import { afterEach, describe, expect, it, vi } from "vitest";
import type { Request, RequestHandler, Response } from "express";

/**
 * El endpoint de despacho dispara correos y WhatsApp reales, así que la puerta
 * importa más que el resto de middlewares. Estas pruebas cubren los tres estados
 * que puede devolver: sin secreto configurado (503), credencial mala (401) y
 * credencial buena (pasa).
 */

const cargarMiddleware = async (secreto: string): Promise<RequestHandler> => {
  vi.resetModules();
  vi.stubEnv("CRON_SECRET", secreto);

  const { requireCronSecret } = await import("@/middleware/cron.middleware");
  return requireCronSecret;
};

interface Resultado {
  status: number | null;
  body: unknown;
  paso: boolean;
}

const ejecutar = (middleware: RequestHandler, authorization?: string): Resultado => {
  const resultado: Resultado = { status: null, body: undefined, paso: false };

  const req = { headers: authorization ? { authorization } : {} } as unknown as Request;
  const res = {
    status(codigo: number) {
      resultado.status = codigo;
      return this;
    },
    json(cuerpo: unknown) {
      resultado.body = cuerpo;
      return this;
    },
  } as unknown as Response;

  middleware(req, res, () => {
    resultado.paso = true;
  });

  return resultado;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireCronSecret", () => {
  it("falla cerrado si el entorno no configuró el secreto", async () => {
    const middleware = await cargarMiddleware("");

    const resultado = ejecutar(middleware, "Bearer cualquier-cosa");

    expect(resultado.status).toBe(503);
    expect(resultado.body).toMatchObject({ error: { code: "CRON_NO_CONFIGURADO" } });
    expect(resultado.paso).toBe(false);
  });

  it("rechaza una petición sin credencial", async () => {
    const middleware = await cargarMiddleware("secreto-de-prueba");

    const resultado = ejecutar(middleware);

    expect(resultado.status).toBe(401);
    expect(resultado.paso).toBe(false);
  });

  it("rechaza un secreto incorrecto de la misma longitud", async () => {
    const middleware = await cargarMiddleware("secreto-de-prueba");

    const resultado = ejecutar(middleware, "Bearer secreto-de-pruebaX");

    expect(resultado.status).toBe(401);
    expect(resultado.paso).toBe(false);
  });

  it("rechaza el esquema que no sea Bearer", async () => {
    const middleware = await cargarMiddleware("secreto-de-prueba");

    expect(ejecutar(middleware, "Basic secreto-de-prueba").status).toBe(401);
    expect(ejecutar(middleware, "secreto-de-prueba").status).toBe(401);
  });

  it("deja pasar el secreto correcto", async () => {
    const middleware = await cargarMiddleware("secreto-de-prueba");

    const resultado = ejecutar(middleware, "Bearer secreto-de-prueba");

    expect(resultado.paso).toBe(true);
    expect(resultado.status).toBeNull();
  });

  it("tolera espacios sobrantes y el esquema en minúsculas", async () => {
    const middleware = await cargarMiddleware("secreto-de-prueba");

    expect(ejecutar(middleware, "  bearer   secreto-de-prueba  ").paso).toBe(true);
  });
});
