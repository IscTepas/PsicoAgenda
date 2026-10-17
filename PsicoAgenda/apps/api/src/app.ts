import cors from "cors";
import express from "express";
import compression from "compression";
import { config } from "@/config";
import { errorHandler, notFoundHandler } from "@/middleware/error.middleware";
import { apiRouter } from "@/routes";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(compression());
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
