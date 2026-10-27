import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
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
      handler: new NetworkOnly(),
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
