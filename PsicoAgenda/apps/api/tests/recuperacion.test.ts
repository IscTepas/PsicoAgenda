import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { enviarEnlaceRecuperacion, actualizarContrasena, findUnique } = vi.hoisted(() => ({
  enviarEnlaceRecuperacion: vi.fn(),
  actualizarContrasena: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/services/mailer.service", () => ({ enviarEnlaceRecuperacion }));
vi.mock("@/lib/supabase-admin", () => ({ actualizarContrasena }));
vi.mock("@/lib/prisma", () => ({ prisma: { usuarios: { findUnique } }, disconnectPrisma: vi.fn() }));

const { vaciar } = vi.hoisted(() => ({ vaciar: { fn: () => {} } }));
vi.mock("@/services/codigo-cache.repo", async () => {
  const { crearCacheEnMemoria } = await import("./helpers/cache-en-memoria");
  const cache = crearCacheEnMemoria();
  vaciar.fn = cache.vaciar;
  return { cacheRegistro: cache.cacheRegistro, limpiarCacheRegistroVencida: () => Promise.resolve(0) };
});

const { createApp } = await import("@/create-app");
const { MAX_POR_CORREO, TOKEN_TTL_SECONDS } = await import("@/services/recuperacion.service");

const app = createApp();
const EMAIL = "persona@ejemplo.com";
const PASSWORD = "NuevaClave1";

const solicitar = (email = EMAIL, ip = "1.1.1.1") =>
  request(app).post("/api/auth/recuperacion/solicitar").set("X-Forwarded-For", ip).send({ email });
const confirmar = (token: string, password = PASSWORD) =>
  request(app).post("/api/auth/recuperacion/confirmar").send({ token, password });

/** Token del enlace que se habría mandado por correo. */
const tokenEnviado = (): string => {
  const enlace = enviarEnlaceRecuperacion.mock.calls.at(-1)?.[1] as string;
  return new URL(enlace).searchParams.get("token")!;
};

beforeEach(() => {
  vaciar.fn();
  vi.clearAllMocks();
  findUnique.mockResolvedValue({ id: "u-1", activo: true });
  actualizarContrasena.mockResolvedValue(undefined);
  enviarEnlaceRecuperacion.mockResolvedValue(undefined);
});

afterEach(() => vi.useRealTimers());

describe("POST /api/auth/recuperacion/solicitar", () => {
  it("con cuenta existente envía un enlace al frontend con el token", async () => {
    const res = await solicitar();

    expect(res.status).toBe(202);
    expect(enviarEnlaceRecuperacion).toHaveBeenCalledTimes(1);
    const enlace = enviarEnlaceRecuperacion.mock.calls[0]![1] as string;
    expect(enlace).toMatch(/\/recuperar\/nueva\?token=[A-Za-z0-9_-]{43}$/);
  });

  it("sin cuenta responde igual y no envía nada", async () => {
    findUnique.mockResolvedValue(null);

    const res = await solicitar("nadie@ejemplo.com");

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ ok: true });
    expect(enviarEnlaceRecuperacion).not.toHaveBeenCalled();
  });

  it("si el correo falla responde igual (no revela que la cuenta existe)", async () => {
    enviarEnlaceRecuperacion.mockRejectedValue(new Error("SMTP caído"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect((await solicitar()).status).toBe(202);
  });

  it("corta con 429 y el tiempo de espera al pasar el límite por correo", async () => {
    for (let i = 0; i < MAX_POR_CORREO; i++) expect((await solicitar()).status).toBe(202);

    const res = await solicitar();

    expect(res.status).toBe(429);
    expect(res.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(enviarEnlaceRecuperacion).toHaveBeenCalledTimes(MAX_POR_CORREO);
  });
});

describe("POST /api/auth/recuperacion/confirmar", () => {
  it("cambia la contraseña y el mismo enlace ya no sirve una segunda vez", async () => {
    await solicitar();
    const token = tokenEnviado();

    expect((await confirmar(token)).status).toBe(200);
    expect(actualizarContrasena).toHaveBeenCalledWith("u-1", PASSWORD);

    const otraVez = await confirmar(token);
    expect(otraVez.status).toBe(400);
    expect(otraVez.body.error.code).toBe("TOKEN_INVALIDO");
  });

  it("rechaza un token vencido", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await solicitar();
    const token = tokenEnviado();
    vi.setSystemTime(Date.now() + (TOKEN_TTL_SECONDS + 1) * 1000);

    expect((await confirmar(token)).status).toBe(400);
    expect(actualizarContrasena).not.toHaveBeenCalled();
  });

  it("rechaza una contraseña que no cumple las reglas", async () => {
    await solicitar();

    expect((await confirmar(tokenEnviado(), "corta")).status).toBe(400);
    expect(actualizarContrasena).not.toHaveBeenCalled();
  });

  it("si el proveedor falla, el enlace sigue sirviendo", async () => {
    await solicitar();
    const token = tokenEnviado();
    const { AppError } = await import("@/utils/app-error");
    actualizarContrasena.mockRejectedValueOnce(new AppError(503, "caído", "AUTH_ERROR"));

    expect((await confirmar(token)).status).toBe(503);
    expect((await confirmar(token)).status).toBe(200);
  });
});
