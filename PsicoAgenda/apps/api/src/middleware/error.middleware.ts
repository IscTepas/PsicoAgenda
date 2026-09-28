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

  console.error(err);

  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Error interno del servidor",
      ...(isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
    },
  });
};
