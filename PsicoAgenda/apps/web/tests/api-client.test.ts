import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_API_PORT } from "@psicoagenda/shared";

/**
 * La URL del API se escribe a mano en Vercel y de ahí viaja a tres sitios: el
 * bundle del cliente, el `rewrite` de `next.config.ts` y el build. Dos errores
 * reales ya rompieron el despliegue:
 *
 *  - barra final (`https://.../`): produce `//api/...`, Vercel responde 308 y el
 *    preflight CORS muere con "Redirect is not allowed for a preflight request";
 *  - host sin esquema (`api.vercel.app`): Next rechaza el rewrite y el build
 *    falla con "`destination` does not start with `/`, `http://`, or `https://`".
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

  it("añade https a un host sin esquema", async () => {
    // Es el caso que tumbó el build: `NEXT_PUBLIC_API_URL=psico-agenda-api.vercel.app`.
    await expect(cargarApiUrl("psico-agenda-api.vercel.app")).resolves.toBe(
      "https://psico-agenda-api.vercel.app",
    );
  });

  it("añade https y quita la barra final a la vez", async () => {
    await expect(cargarApiUrl("psico-agenda-api.vercel.app/")).resolves.toBe(
      "https://psico-agenda-api.vercel.app",
    );
  });

  it("añade http a un host local sin esquema", async () => {
    await expect(cargarApiUrl("localhost:4000")).resolves.toBe("http://localhost:4000");
    await expect(cargarApiUrl("127.0.0.1:4000")).resolves.toBe("http://127.0.0.1:4000");
  });

  it("respeta un https explícito en localhost", async () => {
    await expect(cargarApiUrl("https://localhost:4000")).resolves.toBe("https://localhost:4000");
  });

  it("sube a https un host público escrito con http (Mixed Content)", async () => {
    // Con http:// el build pasaba, pero el navegador bloqueaba la petición
    // desde la página https.
    await expect(cargarApiUrl("http://psico-agenda-api.vercel.app")).resolves.toBe(
      "https://psico-agenda-api.vercel.app",
    );
  });

  it("ignora espacios alrededor del valor", async () => {
    await expect(cargarApiUrl("  https://api.ejemplo.com  ")).resolves.toBe(
      "https://api.ejemplo.com",
    );
  });

  it("cae al API local cuando la variable no está definida o está vacía", async () => {
    await expect(cargarApiUrl(undefined)).resolves.toBe(`http://localhost:${DEFAULT_API_PORT}`);
    await expect(cargarApiUrl("")).resolves.toBe(`http://localhost:${DEFAULT_API_PORT}`);
    await expect(cargarApiUrl("   ")).resolves.toBe(`http://localhost:${DEFAULT_API_PORT}`);
  });

  it("nunca deja un destino de rewrite inválido ni una URL insegura", async () => {
    // Next exige que el `destination` empiece por `/`, `http://` o `https://`;
    // y desde una página https un `http://` público lo bloquea el navegador.
    for (const valor of [
      undefined,
      "",
      "psico-agenda-api.vercel.app",
      "https://psico-agenda-api.vercel.app/",
      "http://psico-agenda-api.vercel.app",
      "http://localhost:4000",
    ]) {
      const url = await cargarApiUrl(valor);
      expect(url).toMatch(/^(https?:\/\/|\/)/);
      if (!url.includes("localhost") && !url.includes("127.0.0.1")) {
        expect(url).toMatch(/^https:\/\//);
      }
    }
  });
});

