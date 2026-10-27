import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_API_PORT } from "@psicoagenda/shared";

/**
 * El `//` en la URL del API no es cosmético: `${API_URL}/api/...` con barra final
 * produce `//api/...`, Vercel responde 308 a esa ruta y el navegador rechaza el
 * preflight CORS ("Redirect is not allowed for a preflight request"). Pasó en
 * producción con `NEXT_PUBLIC_API_URL=https://.../`.
 *
 * Estas pruebas fijan la normalización para que no vuelva a colarse.
 */

const cargarApiUrl = async (valor?: string): Promise<string> => {
  vi.resetModules();
  vi.unstubAllEnvs();

  if (valor === undefined) {
    delete process.env.NEXT_PUBLIC_API_URL;
  } else {
    vi.stubEnv("NEXT_PUBLIC_API_URL", valor);
  }

  const { API_URL } = await import("@/lib/api-client");
  return API_URL;
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("API_URL", () => {
  it("quita la barra final", async () => {
    await expect(cargarApiUrl("https://api.ejemplo.com/")).resolves.toBe("https://api.ejemplo.com");
  });

  it("quita varias barras finales", async () => {
    await expect(cargarApiUrl("https://api.ejemplo.com///")).resolves.toBe(
      "https://api.ejemplo.com",
    );
  });

  it("no toca una URL que ya viene limpia", async () => {
    await expect(cargarApiUrl("https://api.ejemplo.com")).resolves.toBe("https://api.ejemplo.com");
  });

  it("no rompe una URL con puerto y ruta", async () => {
    await expect(cargarApiUrl("http://localhost:4000/")).resolves.toBe("http://localhost:4000");
  });

  it("cae al API local cuando la variable no está definida", async () => {
    await expect(cargarApiUrl(undefined)).resolves.toBe(`http://localhost:${DEFAULT_API_PORT}`);
  });
});
