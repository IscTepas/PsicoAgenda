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
  // La página offline se precachea a mano porque la genera Next, no el glob de assets.
  additionalPrecacheEntries: [{ url: "/offline", revision: "1" }],
});
