import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";

/**
 * El alta en dos pasos se prueba sobre `registro.service`: lo que importa es que el
 * primer paso llame a la API y nunca a `auth.signUp`, y que el segundo confirme el
 * código, inicie sesión y navegue sin perder los datos del formulario.
 *
 * Un test de componente exigiria jsdom + Testing Library, que este paquete no
 * instala; por eso el servicio concentra la logica y se verifica aislado.
 */
const { apiFetch, signInWithPassword, refreshSession, signUp } = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  signInWithPassword: vi.fn(),
  refreshSession: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return { ...actual, apiFetch };
});

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithPassword, refreshSession, signUp } }),
  isSupabaseConfigured: () => true,
}));

import {
  DIGITOS_TELEFONO,
  RUTA_TRAS_REGISTRO,
  completarRegistro,
  construirPayloadRegistro,
  formatearTelefono,
  formatearTelefonoPegado,
  leerCodigoDelPortapapeles,
  mensajeDeRegistro,
  normalizarCodigo,
  registroService,
  segundosDeEspera,
  type DatosRegistro,
} from "@/services/registro.service";

const RESPUESTA_PRE_REGISTRO = {
  ok: true as const,
  expiresInSeconds: 600,
  resendCooldownSeconds: 60,
};

const DATOS: DatosRegistro = {
  email: "  Paciente.Demo@Example.com ",
  password: "ClaveSegura123",
  name: "Ana Perez",
  phone: "+52 55 1234 5678",
  birthDate: "1995-04-12",
  gender: "female",
  address: "Calle 1",
  emergencyContactName: "Luis Perez",
  emergencyContactPhone: "+52 55 8765 4321",
  emergencyContactRelationship: "Hermano",
};

/** Fecha que siempre cae en menor de edad, sin importar el mes en que se corra. */
const FECHA_MENOR = `${new Date().getFullYear() - 15}-01-15`;

const DATOS_MENOR: DatosRegistro = {
  ...DATOS,
  birthDate: FECHA_MENOR,
  guardianName: "Marta Perez",
  guardianPhone: "+52 55 1111 2222",
  guardianRelationship: "Madre",
};

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockResolvedValue(RESPUESTA_PRE_REGISTRO);
  signInWithPassword.mockResolvedValue({ error: null });
  refreshSession.mockResolvedValue({ error: null });
});

describe("paso 1: pedir el código", () => {
  it("llama al endpoint de pre-registro de la API y no crea la cuenta", async () => {
    const respuesta = await registroService.solicitarCodigo(construirPayloadRegistro(DATOS));

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch.mock.calls[0][0]).toBe("/auth/pre-registro");
    expect(apiFetch.mock.calls[0][1]).toMatchObject({ method: "POST" });
    expect(signUp).not.toHaveBeenCalled();
    expect(respuesta).toEqual(RESPUESTA_PRE_REGISTRO);
  });

  it("arma el payload con el correo normalizado y sin rol ni is_minor (los deriva el servidor)", () => {
    const payload = construirPayloadRegistro(DATOS);

    expect(payload.email).toBe("paciente.demo@example.com");
    expect(payload).not.toHaveProperty("role");
    expect(payload).not.toHaveProperty("is_minor");
    expect(payload.name).toBe("Ana Perez");
    expect(payload.birth_date).toBe("1995-04-12");
    expect(payload.emergency_contact).toEqual({
      name: "Luis Perez",
      phone: "+52 55 8765 4321",
      relationship: "Hermano",
    });
  });

  it("no manda tutor a una persona adulta y sí lo manda si la fecha es de una persona menor", () => {
    expect(construirPayloadRegistro(DATOS).guardian).toBeUndefined();
    expect(construirPayloadRegistro(DATOS_MENOR).guardian).toEqual({
      name: "Marta Perez",
      phone: "+52 55 1111 2222",
      relationship: "Madre",
    });
  });

  it("propaga el error de la API cuando no se pudo enviar el correo", async () => {
    apiFetch.mockRejectedValueOnce(
      new ApiError(503, "MAILER_ERROR", "No pudimos enviar el correo con el codigo."),
    );

    await expect(
      registroService.solicitarCodigo(construirPayloadRegistro(DATOS)),
    ).rejects.toBeInstanceOf(ApiError);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("explica el cooldown de reenvío con los segundos que informa la API", async () => {
    apiFetch.mockRejectedValueOnce(
      new ApiError(429, "COOLDOWN", "Espera antes de pedir otro codigo.", {
        retryAfterSeconds: 42,
      }),
    );

    const fallo = await registroService
      .solicitarCodigo(construirPayloadRegistro(DATOS))
      .catch((error: unknown) => error);

    expect(segundosDeEspera(fallo)).toBe(42);
    expect(mensajeDeRegistro(fallo)).toContain("42 segundos");
  });
});

describe("paso 2: verificar el código", () => {
  it("envía el código junto con el payload completo a verificar-codigo", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      user: { id: "uuid-1", email: "paciente.demo@example.com" },
    });

    await completarRegistro(DATOS, "123456", vi.fn());

    expect(apiFetch.mock.calls[0][0]).toBe("/auth/verificar-codigo");
    expect(apiFetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: expect.objectContaining({
        email: "paciente.demo@example.com",
        codigo: "123456",
        name: "Ana Perez",
        birth_date: "1995-04-12",
      }),
    });
  });

  it("en éxito inicia sesión y entra al panel, sin pasar por signUp", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      user: { id: "uuid-1", email: "paciente.demo@example.com" },
    });
    const navegar = vi.fn();

    await completarRegistro(DATOS, "123456", navegar);

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "paciente.demo@example.com",
      password: "ClaveSegura123",
    });
    expect(refreshSession).toHaveBeenCalled();
    expect(navegar).toHaveBeenCalledWith(RUTA_TRAS_REGISTRO);
    expect(navegar).toHaveBeenCalledWith("/dashboard");
    expect(signUp).not.toHaveBeenCalled();
  });

  it("con el código vencido deja a la persona en el paso del código, con sus datos intactos", async () => {
    apiFetch.mockRejectedValueOnce(
      new ApiError(410, "CODIGO_EXPIRADO", "El codigo expiro.", { retryAfterSeconds: 600 }),
    );
    const navegar = vi.fn();

    const fallo = await completarRegistro(DATOS, "123456", navegar).catch(
      (error: unknown) => error,
    );

    expect(fallo).toBeInstanceOf(ApiError);
    expect(mensajeDeRegistro(fallo)).toBe("El código expiró. Solicita uno nuevo.");
    expect(navegar).not.toHaveBeenCalled();
    expect(signInWithPassword).not.toHaveBeenCalled();
    // La petición viajó con todos los datos: no se perdió nada de lo escrito.
    expect(apiFetch.mock.calls[0][1].body).toMatchObject({
      name: "Ana Perez",
      phone: "+52 55 1234 5678",
      emergency_contact: expect.objectContaining({ name: "Luis Perez" }),
    });
  });

  it("con el código incorrecto avisa y no crea sesión", async () => {
    apiFetch.mockRejectedValueOnce(
      new ApiError(400, "CODIGO_INVALIDO", "El codigo no es correcto."),
    );
    const navegar = vi.fn();

    const fallo = await completarRegistro(DATOS, "000000", navegar).catch(
      (error: unknown) => error,
    );

    expect(mensajeDeRegistro(fallo)).toBe("El código no es correcto. Revísalo e inténtalo de nuevo.");
    expect(navegar).not.toHaveBeenCalled();
  });

  it("si el código se agotó pide uno nuevo", () => {
    const fallo = new ApiError(429, "CODIGO_AGOTADO", "Demasiados intentos.");

    expect(mensajeDeRegistro(fallo)).toBe(
      "Se agotaron los intentos para este código. Solicita uno nuevo.",
    );
  });

  it("si el inicio de sesión falla, avisa que la cuenta sí se creó y no navega", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      user: { id: "uuid-1", email: "paciente.demo@example.com" },
    });
    signInWithPassword.mockResolvedValueOnce({ error: { message: "Invalid login credentials" } });
    const navegar = vi.fn();

    const fallo = await completarRegistro(DATOS, "123456", navegar).catch(
      (error: unknown) => error,
    );

    expect(fallo).toBeInstanceOf(Error);
    expect((fallo as Error).message).toContain("Tu cuenta se creó correctamente");
    expect(navegar).not.toHaveBeenCalled();
  });
});

describe("mensajes de error", () => {
  it("conserva el mensaje del servidor cuando la cuenta ya existe", () => {
    const fallo = new ApiError(
      409,
      "CONFLICT",
      "Ya existe una cuenta registrada con este correo electrónico.",
    );

    expect(mensajeDeRegistro(fallo)).toBe(
      "Ya existe una cuenta registrada con este correo electrónico.",
    );
  });

  it("traduce el rate limit por IP", () => {
    const fallo = new ApiError(429, "RATE_LIMIT", "Demasiadas solicitudes.", {
      retryAfterSeconds: 600,
    });

    expect(segundosDeEspera(fallo)).toBe(600);
    expect(mensajeDeRegistro(fallo)).toContain("Demasiadas solicitudes");
  });

  it("no filtra un fallo de red crudo", () => {
    expect(mensajeDeRegistro(new TypeError("fetch failed"))).toContain(
      "No se pudo conectar con el servicio de registro",
    );
    expect(segundosDeEspera(new TypeError("fetch failed"))).toBeNull();
  });
});

describe("normalizarCodigo", () => {
  it("acepta el código copiado tal cual", () => {
    expect(normalizarCodigo("019360")).toBe("019360");
  });

  it("acepta el código con espacios entre dígitos", () => {
    expect(normalizarCodigo(" 0 1 9 3 6 0 ")).toBe("019360");
  });

  it("extrae el código del texto completo del correo", () => {
    expect(
      normalizarCodigo(
        "Tu código de verificación de PsicoAgenda es: 019360\nVálido durante 10 minutos.",
      ),
    ).toBe("019360");
  });

  it("se queda con los primeros seis dígitos si vienen pegados", () => {
    expect(normalizarCodigo("019360123")).toBe("019360");
  });

  it("devuelve vacío cuando no hay dígitos", () => {
    expect(normalizarCodigo("sin código")).toBe("");
  });
});

describe("leerCodigoDelPortapapeles", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve el código que hay en el portapapeles", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { readText: vi.fn().mockResolvedValue("0 1 9 3 6 0") },
    });

    await expect(leerCodigoDelPortapapeles()).resolves.toBe("019360");
  });

  it("explica cómo pegar cuando el navegador no expone el portapapeles", async () => {
    vi.stubGlobal("navigator", {});

    await expect(leerCodigoDelPortapapeles()).rejects.toThrow(/Ctrl\+V/);
  });

  it("avisa cuando se deniega el permiso", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { readText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    await expect(leerCodigoDelPortapapeles()).rejects.toThrow(/No se pudo leer el portapapeles/);
  });

  it("avisa cuando el portapapeles no tiene un código", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { readText: vi.fn().mockResolvedValue("hola") },
    });

    await expect(leerCodigoDelPortapapeles()).rejects.toThrow(/No encontré un código de 6 dígitos/);
  });
});

describe("formatearTelefono", () => {
  it("agrupa 3-3-4 mientras se escribe", () => {
    expect(formatearTelefono("5")).toBe("5");
    expect(formatearTelefono("5551")).toBe("555-1");
    expect(formatearTelefono("555123")).toBe("555-123");
    expect(formatearTelefono("5551234")).toBe("555-123-4");
    expect(formatearTelefono("5551234567")).toBe("555-123-4567");
  });

  it("descarta todo lo que no sea dígito", () => {
    expect(formatearTelefono("(555) 123-4567")).toBe("555-123-4567");
  });

  it(`no pasa de ${DIGITOS_TELEFONO} dígitos`, () => {
    expect(formatearTelefono("555123456789")).toBe("555-123-4567");
  });

  it("devuelve vacío si no hay dígitos", () => {
    expect(formatearTelefono("abc")).toBe("");
  });
});

describe("formatearTelefonoPegado", () => {
  it("se queda con los últimos 10 dígitos al pegar con lada", () => {
    expect(formatearTelefonoPegado("+52 55 1234 5678")).toBe("551-234-5678");
  });

  it("formatea un pegado de 10 dígitos", () => {
    expect(formatearTelefonoPegado("5551234567")).toBe("555-123-4567");
  });
});
