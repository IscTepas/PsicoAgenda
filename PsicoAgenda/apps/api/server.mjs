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
import express from "express";
import { createApp } from "./dist/create-app.js";

/**
 * El import de `express` de arriba NO es decorativo: es el contrato del preset.
 *
 * Vercel elige el entrypoint leyendo el TEXTO de este archivo y aplicando
 *   /(?:from|require|import)\s*(?:\(\s*)?["']express["']\s*(?:\))?/
 * (packages/express/src/build.ts). No sigue el grafo de imports, así que un
 * entry que solo reexporta `dist/create-app.js` se rechaza con
 * "No entrypoint found which imports express", aunque la app use express por
 * dentro. No quitar: el build deja de encontrar el entrypoint.
 *
 * Además, el archivo debe exportar la app como default (lo hace la última
 * línea). `createApp()` es quien construye y configura la aplicación.
 */
export default createApp();
