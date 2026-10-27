import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { enviarCodigoRegistro, fetchMock } = vi.hoisted(() => {
  // Clave de servicio inyectada antes de cargar la configuración, para no
  // depender del `.env` de la máquina (dotenv no pisa variables ya definidas).
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_de_prueba";
  return { enviarCodigoRegistro: vi.fn(), fetchMock: vi.fn() };
});

// El mailer nunca sale a la red: se verifica que el código se le entrega.
vi.mock("@/services/mailer.service", () => ({ enviarCodigoRegistro }));
// La base de datos de negocio no participa en el pre-registro.
vi.mock("@/lib/prisma", () => ({ prisma: {}, disconnectPrisma: vi.fn() }));

// Los códigos de registro viven en Postgres (`cache_registro`). En pruebas se
// sustituye el repositorio por un Map en memoria para no necesitar base de datos.
vi.mock("@/services/codigo-cache.repo", async () => {
  const { crearCacheEnMemoria } = await import("./helpers/cache-en-memoria");
  const { cacheRegistro, vaciar } = crearCacheEnMemoria();

  return {
    cacheRegistro,
    vaciarCacheRegistro: () => Promise.resolve(vaciar()),
    limpiarCacheRegistroVencida: () => Promise.resolve(0),
  };
});

// La consulta de "correo ya registrado" usa `fetch` contra el admin de GoTrue:
// se intercepta.
vi.stubGlobal("fetch", fetchMock);

const { createApp } = await import("@/create-app");
const { limpiarCacheRegistro } = await import("@/services/codigo.service");
const { AppError } = await import("@/utils/app-error");

const app = createApp();

const EMAIL = "persona@ejemplo.com";
const PASSWORD = "ClaveSegura1";

const payloadValido = (overrides: Record<string, unknown> = {}) => ({
  email: EMAIL,
  password: PASSWORD,
  name: "Persona Ejemplo",
  phone: "5512345678",
  birth_date: "1990-05-01",
  emergency_contact: { name: "Contacto Ejemplo", phone: "5587654321", relationship: "Madre" },
  ...overrides,
});

interface ErrorBody {
  error: { code: string; message: string; details?: { retryAfterSeconds?: number } };
}

const postPreRegistro = (body: unknown) => request(app).post("/api/auth/pre-registro").send(body);

/** Respuesta del admin de GoTrue: usuarios ya registrados cuyo correo contiene el filtro. */
const responderUsuarios = (emails: string[] = []) => {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ users: emails.map((email) => ({ email })) }),
  });
};

beforeEach(async () => {
  await limpiarCacheRegistro();
  fetchMock.mockReset();
  enviarCodigoRegistro.mockReset();
  enviarCodigoRegistro.mockResolvedValue(undefined);
  responderUsuarios();
});

describe("POST /api/auth/pre-registro", () => {
  it("201: genera y envía el código sin crear nada todavía", async () => {
    const respuesta = await postPreRegistro(payloadValido());

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({
      ok: true,
      expiresInSeconds: 600,
      resendCooldownSeconds: 60,
    });
    expect(enviarCodigoRegistro).toHaveBeenCalledTimes(1);
    expect(enviarCodigoRegistro).toHaveBeenCalledWith(EMAIL, expect.stringMatching(/^\d{6}$/));
  });

  it("409: rechaza un correo ya registrado y no envía código", async () => {
    responderUsuarios([EMAIL]);

    const respuesta = await postPreRegistro(payloadValido());
    const body = respuesta.body as ErrorBody;

    expect(respuesta.status).toBe(409);
    expect(body.error.message).toContain("Ya existe una cuenta");
    expect(enviarCodigoRegistro).not.toHaveBeenCalled();
  });

  it("no confunde un correo que contiene a otro (coincidencia exacta, no subcadena)", async () => {
    // El filtro del admin de GoTrue es parcial; `xpersona@ejemplo.com` NO es
    // la cuenta de `persona@ejemplo.com`.
    responderUsuarios([`x${EMAIL}`]);

    const respuesta = await postPreRegistro(payloadValido());

    expect(respuesta.status).toBe(201);
  });

  it("429: bloquea el reenvío dentro del cooldown y responde los segundos restantes", async () => {
    await postPreRegistro(payloadValido());
    enviarCodigoRegistro.mockClear();

    const respuesta = await postPreRegistro(payloadValido());
    const body = respuesta.body as ErrorBody;

    expect(respuesta.status).toBe(429);
    expect(body.error.code).toBe("COOLDOWN");
    expect(body.error.details?.retryAfterSeconds).toBe(60);
    expect(enviarCodigoRegistro).not.toHaveBeenCalled();
  });

  it("429: corta por rate limit tras 5 solicitudes de la misma IP", async () => {
    for (let solicitud = 0; solicitud < 5; solicitud++) {
      const respuesta = await postPreRegistro(payloadValido({ email: `persona${solicitud}@ejemplo.com` }));
      expect(respuesta.status).toBe(201);
    }
    expect(enviarCodigoRegistro).toHaveBeenCalledTimes(5);

    const respuesta = await postPreRegistro(payloadValido({ email: "sexta@ejemplo.com" }));
    const body = respuesta.body as ErrorBody;

    expect(respuesta.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMIT");
    expect(enviarCodigoRegistro).toHaveBeenCalledTimes(5);
    // La sexta ni siquiera consultó Auth: el corte fue antes de la llamada externa.
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("400: revalida el payload y no gasta llamadas externas si es inválido", async () => {
    const respuesta = await postPreRegistro(
      payloadValido({ password: "corta", emergency_contact: undefined }),
    );

    expect(respuesta.status).toBe(400);
    expect(enviarCodigoRegistro).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("503: si el correo no sale, retira el código y libera el cooldown", async () => {
    enviarCodigoRegistro.mockRejectedValueOnce(
      new AppError(503, "No se pudo enviar el código de verificación.", "MAILER_ERROR"),
    );

    const fallida = await postPreRegistro(payloadValido());
    expect(fallida.status).toBe(503);

    // Sin código huérfano ni cooldown fantasma: el reintento pasa de inmediato.
    const reintento = await postPreRegistro(payloadValido());
    expect(reintento.status).toBe(201);
    expect(enviarCodigoRegistro).toHaveBeenCalledTimes(2);
  });
});
