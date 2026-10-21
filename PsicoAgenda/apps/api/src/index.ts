import { createApp } from "@/app";
import { config } from "@/config";
import { disconnectPrisma } from "@/lib/prisma";
import { iniciarDespachador } from "@/services/notification.service";

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
