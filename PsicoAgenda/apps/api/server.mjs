/**
 * Entry de Vercel (modo Express zero-config, detectado por el nombre `server.mjs`).
 *
 * Importa la app ya compilada a `dist/`: así `tsc-alias` ya reescribió los alias
 * `@/` a rutas relativas y `@psicoagenda/shared` resuelve a su `dist` por el
 * workspace, en vez de pelear con los path aliases dentro del bundler de Vercel.
 *
 * El build del proyecto (`tsc -b`) tiene que correr antes: lo hace el script
 * `vercel-build` de apps/api/package.json.
 */
import { createApp } from "./dist/create-app.js";

export default createApp();
