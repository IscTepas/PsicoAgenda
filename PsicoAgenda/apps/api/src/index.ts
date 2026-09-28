import { createApp } from "@/app";
import { config } from "@/config";

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`API de PsicoAgenda escuchando en http://localhost:${config.port} (${config.nodeEnv})`);
});

const shutdown = (signal: string) => {
  console.log(`\n${signal} recibido, cerrando servidor...`);
  server.close(() => process.exit(0));
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
