import { DEFAULT_API_PORT } from "@psicoagenda/shared";

/**
 * Normaliza la URL del API a una sola forma canónica.
 *
 * Existe porque el valor se escribe a mano en Vercel y viaja a tres sitios que
 * fallan distinto si está mal: el bundle del cliente, el `rewrite` de
 * `next.config.ts` y el build. Ya rompió el despliegue tres veces:
 *
 *  1. barra final (`https://api.vercel.app/`) → `//api/...`, Vercel responde 308
 *     y el preflight CORS muere con "Redirect is not allowed for a preflight
 *     request";
 *  2. host sin esquema (`api.vercel.app`) → Next rechaza el rewrite con
 *     "`destination` does not start with `/`, `http://`, or `https://`" y el
 *     build entero falla;
 *  3. esquema incorrecto (`http://api.vercel.app`) → el build pasa, pero el
 *     navegador bloquea la petición por Mixed Content desde la página https.
 *
 * Se corrige en vez de fallar: ninguna de las tres variantes debe tumbar un
 * despliegue, y la elección de esquema no es ambigua (un host público siempre es
 * https; la máquina local siempre es http, salvo que se pida https explícito).
 */

const API_LOCAL = `http://localhost:${DEFAULT_API_PORT}`;

const esHostLocal = (hostname: string): boolean =>
  /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(hostname);

export function normalizarApiUrl(valor: string | undefined): string {
  const limpio = (valor ?? "").trim().replace(/\/+$/, "");
  if (!limpio) return API_LOCAL;

  const tieneEsquema = /^https?:\/\//i.test(limpio);

  let url: URL;
  try {
    url = new URL(tieneEsquema ? limpio : `https://${limpio}`);
  } catch {
    // Valor inservible: se devuelve algo que al menos es un destino de rewrite
    // válido para que el build no se caiga; el error saldrá en la petición.
    return `https://${limpio}`;
  }

  if (esHostLocal(url.hostname)) {
    // Local: http por defecto, pero se respeta un https explícito.
    return tieneEsquema ? url.origin : `http://${url.host}`;
  }

  // Host público: https siempre, aunque se haya escrito http.
  return `https://${url.host}`;
}

export const API_URL = normalizarApiUrl(process.env.NEXT_PUBLIC_API_URL);

/**
 * `false` cuando la variable no está definida (o está vacía), para que el
 * cliente prefiera rutas relativas y Next las reescriba al backend.
 */
export const API_URL_CONFIGURADA = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().length > 0;
