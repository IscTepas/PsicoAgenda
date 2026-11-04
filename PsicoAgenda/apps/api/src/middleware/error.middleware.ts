import type { ErrorRequestHandler, RequestHandler } from "express";
import { AppError } from "@/utils/app-error";

const isProduction = process.env.NODE_ENV === "production";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`No existe el endpoint ${req.method} ${req.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  // Un CHECK de la base (23514) es un dato inválido que la validación no atajó: 400, no 500.
  if (err instanceof Error && /\b23514\b|check constraint/.test(err.message)) {
    res.status(400).json({
      error: { code: "DATOS_INVALIDOS", message: "Algún dato no es válido. Revisa los campos e inténtalo de nuevo." },
    });
    return;
  }

  console.error(err);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
      ...(isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
    },
  });
};
