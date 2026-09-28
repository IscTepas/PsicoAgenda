import jwt from "jsonwebtoken";
import { UserRole } from "@psicoagenda/shared";
import { config } from "@/config";
import { AppError } from "@/utils/app-error";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export const signToken = (user: AuthenticatedUser): string =>
  jwt.sign({ email: user.email, role: user.role }, config.jwtSecret, {
    subject: user.id,
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });

export const verifyToken = (token: string): AuthenticatedUser => {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    if (typeof decoded === "string" || !decoded.sub) {
      throw AppError.unauthorized("Token inválido");
    }

    const { email, role } = decoded as jwt.JwtPayload & { email?: string; role?: UserRole };

    return { id: decoded.sub, email: email ?? "", role: role ?? UserRole.PATIENT };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized("La sesión expiró, vuelve a iniciar sesión");
    }
    throw AppError.unauthorized("Token inválido");
  }
};
