import type { Request } from "express";
import type { AuthenticatedUser } from "@/utils/jwt";

/**
 * Request con la identidad del usuario autenticado, inyectada por `requireAuth`.
 * `auth` es opcional porque las rutas públicas no la incluyen.
 */
export interface AuthedRequest extends Request {
  auth?: AuthenticatedUser;
}
