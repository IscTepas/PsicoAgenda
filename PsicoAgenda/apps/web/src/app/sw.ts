import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const API_TIMEOUT_MS = 10_000;

/**
 * Handler de red con timeout explícito. Evita que peticiones al API queden
 * colgadas indefinidamente cuando la conexión está degradada.
 */
class NetworkOnlyWithTimeout extends NetworkOnly {
  async handle(options: Parameters<NetworkOnly["handle"]>[0]): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("timeout"), API_TIMEOUT_MS);

    try {
      return await super.handle({
        ...options,
        request: new Request(options.request, { signal: controller.signal }),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  // `navigationPreload` puede duplicar peticiones de navegación junto con el
  // prefetch de Next.js; las rutas estáticas siguen precacheadas.
  navigationPreload: false,
  runtimeCaching: [
    {
      /**
       * El API vive en otro origen y responde datos por usuario con la
       * credencial en la cabecera. `defaultCache` aplica `NetworkFirst` a toda
       * petición cross-origin, así que en un equipo compartido —o tras cerrar
       * sesión— un timeout de red podía servir `/api/auth/me` o
       * `/api/patients` desde la caché del usuario anterior.
       *
       * `NetworkOnly` deja el API fuera de la caché: si la red falla, el error
       * lo maneja la aplicación, no el service worker.
       *
       * Serwist evalúa las rutas en orden de registro y gana la primera
       * coincidencia, por eso esta va antes de `defaultCache`.
       *
       * No se usa `NEXT_PUBLIC_API_URL` a propósito: dentro del service worker
       * esa variable no está garantizada en tiempo de build. `!sameOrigin` +
       * `/api/` identifica el API sin depender de ella.
       */
      matcher: ({ url, sameOrigin }) => !sameOrigin && url.pathname.startsWith("/api/"),
      handler: new NetworkOnlyWithTimeout(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
