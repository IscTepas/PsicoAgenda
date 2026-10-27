import cors from "cors";
import express from "express";
import compression from "compression";
import { config } from "@/config";
import { origenPermitido } from "@/lib/cors-origin";
import { errorHandler, notFoundHandler } from "@/middleware/error.middleware";
import { apiRouter } from "@/routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(compression());
  app.use(
    cors({
      // Lista con comodines: ver `lib/cors-origin.ts`. Los previews de Vercel
      // usan un subdominio por rama y sin esto el login fallaría en cada PR.
      origin: (origin, callback) => callback(null, origenPermitido(origin, config.corsOrigins)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
