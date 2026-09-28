import type { RequestHandler } from "express";
import { ZodError, type ZodType } from "zod";
import { AppError } from "@/utils/app-error";

type RequestSchemas = {
  body?: ZodType<unknown>;
  params?: ZodType<unknown>;
  query?: ZodType<unknown>;
};

/**
 * Valida body/params/query contra esquemas Zod de `@psicoagenda/shared` y deja
 * los valores ya parseados (y con defaults aplicados) en la request.
 *
 * Nota Express 5: `req.query` es un getter sin setter, por eso el resultado del
 * parseo se mezcla sobre el objeto existente en lugar de reasignarlo.
 */
export const validate =
  (schemas: RequestSchemas): RequestHandler =>
  (req, _res, next) => {
    try {
    if (schemas.body) req.body = schemas.body.parse(req.body);
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;

    if (schemas.query) {
      const parsed = schemas.query.parse(req.query) as Record<string, unknown>;
      Object.assign(req.query as Record<string, unknown>, parsed);
    }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(AppError.badRequest("Los datos enviados no son válidos", error.flatten()));
        return;
      }
      next(error);
    }
  };
