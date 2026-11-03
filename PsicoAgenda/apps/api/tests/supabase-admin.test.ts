import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUserById } = vi.hoisted(() => {
  // La configuración se carga al importar el módulo: inyectar la clave antes.
  process.env.SUPABASE_URL = "https://proyecto.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_de_prueba";
  return { getUserById: vi.fn() };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { getUserById } } }),
}));

const { esContrasenaActual } = await import("@/lib/supabase-admin");
const { AppError } = await import("@/utils/app-error");

const USER_ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const fetchMock = vi.fn();

const respuesta = (status: number, cuerpo: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(cuerpo),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  getUserById.mockResolvedValue({
    data: { user: { id: USER_ID, email: "persona@ejemplo.com" } },
    error: null,
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("esContrasenaActual", () => {
  it("devuelve true cuando el proveedor acepta el inicio de sesión", async () => {
    fetchMock.mockResolvedValue(respuesta(200, { access_token: "sesion" }));

    await expect(esContrasenaActual(USER_ID, "ClaveActual1")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://proyecto.supabase.co/auth/v1/token?grant_type=password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "persona@ejemplo.com", password: "ClaveActual1" }),
      }),
    );
  });

  it("devuelve false cuando la contraseña no coincide", async () => {
    fetchMock.mockResolvedValue(respuesta(400, { error_code: "invalid_credentials" }));

    await expect(esContrasenaActual(USER_ID, "OtraClave1")).resolves.toBe(false);
  });

  it("devuelve false si la cuenta aún no confirma su correo", async () => {
    fetchMock.mockResolvedValue(respuesta(400, { error_code: "email_not_confirmed" }));

    await expect(esContrasenaActual(USER_ID, "ClaveActual1")).resolves.toBe(false);
  });

  it("falla cerrado si no puede leer la cuenta", async () => {
    getUserById.mockResolvedValue({
      data: { user: null },
      error: { code: "user_not_found", status: 404, message: "User not found" },
    });

    await expect(esContrasenaActual(USER_ID, "ClaveActual1")).rejects.toBeInstanceOf(AppError);
  });

  it("falla cerrado ante un error distinto del proveedor", async () => {
    fetchMock.mockResolvedValue(respuesta(429, { error_code: "over_request_rate_limit" }));

    await expect(esContrasenaActual(USER_ID, "ClaveActual1")).rejects.toMatchObject({
      statusCode: 503,
      code: "AUTH_ERROR",
    });
  });
});
