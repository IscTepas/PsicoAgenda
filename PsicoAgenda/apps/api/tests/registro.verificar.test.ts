import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createUser } = vi.hoisted(() => {
  // Clave de servicio inyectada antes de cargar la configuración, para no
  // depender del `.env` de la máquina (dotenv no pisa variables ya definidas).
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_de_prueba";
  return { createUser: vi.fn() };
});

// El admin de Supabase Auth se intercepta entero: ninguna cuenta real se crea.
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { createUser } } }),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {}, disconnectPrisma: vi.fn() }));

const { createApp } = await import("@/app");
const { generarCodigo, limpiarCacheRegistro } = await import("@/services/codigo.service");

const app = createApp();

const EMAIL = "persona@ejemplo.com";
const PASSWORD = "ClaveSegura1";
const USER_ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

const payloadValido = (overrides: Record<string, unknown> = {}) => ({
  email: EMAIL,
  password: PASSWORD,
  name: "Persona Ejemplo",
  phone: "5512345678",
  birth_date: "1990-05-01",
  emergency_contact: { name: "Contacto Ejemplo", phone: "5587654321", relationship: "Madre" },
  ...overrides,
});

const fechaDeHace = (anios: number): string => {
  const fecha = new Date();
  fecha.setFullYear(fecha.getFullYear() - anios);
  return fecha.toISOString().slice(0, 10);
};

interface ErrorBody {
  error: { code: string; message: string };
}

const postVerificar = (body: unknown) =>
  request(app).post("/api/auth/verificar-codigo").send(body);

const respuestaDeAlta = (userId = USER_ID) => ({
  data: { user: { id: userId } },
  error: null,
});

interface DatosCreateUser {
  email: string;
  password: string;
  email_confirm: boolean;
  user_metadata: Record<string, unknown>;
}

beforeEach(async () => {
  await limpiarCacheRegistro();
  createUser.mockReset();
  createUser.mockResolvedValue(respuestaDeAlta());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/auth/verificar-codigo", () => {
  it("201: crea la cuenta confirmada con los metadatos del expediente", async () => {
    const codigo = await generarCodigo(EMAIL);

    const respuesta = await postVerificar({ ...payloadValido(), codigo });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body).toEqual({ ok: true, user: { id: USER_ID, email: EMAIL } });

    expect(createUser).toHaveBeenCalledTimes(1);
    const alta = createUser.mock.calls[0]?.[0] as DatosCreateUser;
    expect(alta.email).toBe(EMAIL);
    expect(alta.password).toBe(PASSWORD);
    // El correo ya se verificó con el código: la cuenta nace confirmada.
    expect(alta.email_confirm).toBe(true);
    expect(alta.user_metadata).toMatchObject({
      name: "Persona Ejemplo",
      phone: "5512345678",
      role: "patient",
      birth_date: "1990-05-01",
      is_minor: false,
      emergency_contact: {
        name: "Contacto Ejemplo",
        phone: "5587654321",
        relationship: "Madre",
      },
    });
    expect(alta.user_metadata).not.toHaveProperty("guardian");
    // Y no viaja nada que el cliente pudiera colar (p. ej. el propio código).
    expect(alta.user_metadata).not.toHaveProperty("codigo");
  });

  it("borra el código tras el alta: no se puede reutilizar", async () => {
    const codigo = await generarCodigo(EMAIL);

    await postVerificar({ ...payloadValido(), codigo });
    const reutilizado = await postVerificar({ ...payloadValido(), codigo });
    const body = reutilizado.body as ErrorBody;

    expect(reutilizado.status).toBe(410);
    expect(body.error.code).toBe("CODIGO_EXPIRADO");
    expect(createUser).toHaveBeenCalledTimes(1);
  });

  it("400: rechaza un código incorrecto sin crear la cuenta", async () => {
    const codigo = await generarCodigo(EMAIL);
    const incorrecto = codigo === "000000" ? "111111" : "000000";

    const respuesta = await postVerificar({ ...payloadValido(), codigo: incorrecto });
    const body = respuesta.body as ErrorBody;

    expect(respuesta.status).toBe(400);
    expect(body.error.code).toBe("CODIGO_INVALIDO");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("410: rechaza un código vencido a los 10 minutos", async () => {
    const codigo = await generarCodigo(EMAIL);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 601_000);

    const respuesta = await postVerificar({ ...payloadValido(), codigo });
    const body = respuesta.body as ErrorBody;

    expect(respuesta.status).toBe(410);
    expect(body.error.code).toBe("CODIGO_EXPIRADO");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("429: agota el código tras 5 intentos fallidos, aunque el sexto sea el correcto", async () => {
    const codigo = await generarCodigo(EMAIL);
    const incorrecto = codigo === "000000" ? "111111" : "000000";

    for (let intento = 0; intento < 5; intento++) {
      const respuesta = await postVerificar({ ...payloadValido(), codigo: incorrecto });
      expect(respuesta.status).toBe(400);
    }

    const agotado = await postVerificar({ ...payloadValido(), codigo });
    const body = agotado.body as ErrorBody;

    expect(agotado.status).toBe(429);
    expect(body.error.code).toBe("CODIGO_AGOTADO");
    expect(createUser).not.toHaveBeenCalled();
  });

  it("409: un correo ya registrado conserva el mensaje del signUp anterior", async () => {
    const codigo = await generarCodigo(EMAIL);
    createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 422, code: "user_already_exists", message: "User already registered" },
    });

    const respuesta = await postVerificar({ ...payloadValido(), codigo });
    const body = respuesta.body as ErrorBody;

    expect(respuesta.status).toBe(409);
    expect(body.error.message).toContain("Ya existe una cuenta");
  });

  it("400: revalida el payload completo (un menor sin tutor no pasa)", async () => {
    const codigo = await generarCodigo(EMAIL);
    const menorSinTutor = { ...payloadValido({ birth_date: fechaDeHace(10) }), codigo };

    const respuesta = await postVerificar(menorSinTutor);

    expect(respuesta.status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it("201: un menor con tutor llega al alta con el tutor y la minoría derivada", async () => {
    const codigo = await generarCodigo(EMAIL);
    const menorConTutor = {
      ...payloadValido({
        birth_date: fechaDeHace(10),
        guardian: { name: "Tutor Legal", phone: "5511111111", relationship: "Padre" },
      }),
      codigo,
    };

    const respuesta = await postVerificar(menorConTutor);

    expect(respuesta.status).toBe(201);
    const alta = createUser.mock.calls[0]?.[0] as DatosCreateUser;
    expect(alta.user_metadata).toMatchObject({
      is_minor: true,
      guardian: { name: "Tutor Legal", phone: "5511111111", relationship: "Padre" },
    });
  });
});
