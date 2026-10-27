import { createApp } from "@/create-app";
import { config } from "@/config";
import { disconnectPrisma } from "@/lib/prisma";
import { iniciarDespachador } from "@/services/notification.service";

/**
 * Servidor de proceso largo: desarrollo local y cualquier hosting que corra
 * `node dist/dev-server.js` (Railway, Render, una VM).
 *
 * NO se usa en Vercel. Allí el entry es `server.mjs`, que exporta la app sin
 * `listen` y sin despachador: en serverless no hay proceso que viva entre
 * peticiones, así que el barrido de notificaciones lo dispara un cron externo
 * contra `POST /api/internal/despachar` (ver README, "Despliegue").
 *
 * El nombre del archivo importa: Vercel detecta `app|index|server` en la raíz o
 * bajo `src/` para el modo Express zero-config, y `dev-server` queda fuera de
 * esa lista a propósito, para que no elija este entry por error.
 */

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`API de PsicoAgenda escuchando en http://localhost:${config.port} (${config.nodeEnv})`);
});

const detenerDespachador = iniciarDespachador();

let shuttingDown = false;

const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${signal} recibido, cerrando servidor...`);

  // Primero se deja de aceptar peticiones y después se devuelve el pool de
  // conexiones, para no cerrar conexiones que el servidor todavía está usando.
  detenerDespachador();
  server.close(() => {
    disconnectPrisma()
      .catch((error: unknown) => {
        console.error("Error cerrando el pool de Prisma:", error);
      })
      .finally(() => {
        process.exit(0);
      });
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
