import { serwist } from "@serwist/next/config";

/**
 * Configuración de Serwist en "modo configurador".
 *
 * El service worker se compila en un paso aparte (`serwist build`, encadenado
 * tras `next build`), por lo que funciona con Turbopack — el bundler por defecto
 * de Next 16 — a diferencia de `withSerwist`, que exige webpack.
 *
 * En desarrollo el service worker no se compila: `npm run dev` solo levanta
 * `next dev`, y `SerwistProvider` desactiva el registro fuera de producción.
 *
 * @type {import("@serwist/next/config").Serwist}
 */
export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Sin `additionalPrecacheEntries`: el manifiesto de páginas ya incluye
  // `/offline` con su hash de contenido, y añadirlo a mano creaba una segunda
  // entrada con `revision: "1"`. Workbox rechaza dos revisiones distintas para
  // la misma URL (`add-to-cache-list-conflicting-entries`) al construir el
  // precache, y ese throw en la evaluación del módulo se ve en el navegador
  // como "ServiceWorker script evaluation failed".
});
