import type { RequestHandler } from "express";
import type { UserRole } from "@psicoagenda/shared";
import { AppError } from "@/utils/app-error";
import { verifyToken } from "@/utils/jwt";
import type { AuthedRequest } from "@/types/express";

const readBearerToken = (header: string | undefined): string => {
  if (!header) throw AppError.unauthorized();
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw AppError.unauthorized("Se espera un encabezado Authorization: Bearer <token>");
  }
  return token;
};

export const requireAuth: RequestHandler = (req: AuthedRequest, _res, next) => {
  verifyToken(readBearerToken(req.headers.authorization))
    .then((auth) => {
      req.auth = auth;
      next();
    })
    // Cualquier fallo del verificador (firma ajena, caducado, rol ausente) es un 401.
    .catch(() => next(AppError.unauthorized()));
};

export const requireRole =
  (...roles: UserRole[]): RequestHandler =>
  (req: AuthedRequest, _res, next) => {
    if (!req.auth) return next(AppError.unauthorized());
    if (!roles.includes(req.auth.role)) {
      return next(AppError.forbidden("Tu rol no tiene permiso para esta operación"));
    }
    next();
  };
