import { createRemoteJWKSet, jwtVerify, errors as joseErrors, type JWTPayload } from "jose";
import { UserRole } from "@psicoagenda/shared";
import { config } from "@/config";
import { AppError } from "@/utils/app-error";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}

const AUTH_ISSUER = `${config.supabaseUrl}/auth/v1`;
const AUTH_AUDIENCE = "authenticated";
const JWKS_URL = `${AUTH_ISSUER}/.well-known/jwks.json`;

/**
 * El backend no emite tokens: no hay ninguna clave capaz de firmarlos en este
 * servicio. `createRemoteJWKSet` cachea las claves públicas en memoria y revalida
 * según su propia política, así que no hay ida al proveedor por petición.
 */
const jwks = createRemoteJWKSet(new URL(JWKS_URL));

/**
 * El claim del proveedor llega en MAYÚSCULAS (`PSYCHOLOGIST`) porque usa el
 * vocabulario en inglés del proveedor de identidad, mientras que el enum compartido
 * `@psicoagenda/shared` usa minúsculas (`psychologist`). Son dos vocabularios
 * distintos para el mismo concepto, y esta función es el único punto donde se cruzan.
 *
 * El vocabulario del claim NO depende del enum de la base (`rol_usuario`, en
 * español): por eso se compara con literales en inglés y no con los miembros del
 * enum de Prisma. Si el claim y el enum de la base se acoplaran, un cambio de
 * vocabulario en cualquiera de los dos rompería la autorización en silencio.
 *
 * Sin esta normalización, `includes("PSYCHOLOGIST")` nunca encuentra nada en
 * `["psychologist","patient","admin"]` y toda sesión real cae en el rechazo de rol
 * ausente.
 *
 * El cotejo no distingue mayúsculas porque el disparador de alta también las ignora
 * (`upper(raw_app_meta_data ->> 'role')`): si el rol se escribe en minúsculas, el
 * perfil espejado se crea igual, así que el API haría bien en no rechazarlo. El
 * conjunto de valores aceptados sigue siendo cerrado: un rol desconocido no se
 * "aproxima" a ninguno, se rechaza.
 */
const toBusinessRole = (declared: unknown): UserRole | undefined => {
  switch (typeof declared === "string" ? declared.toUpperCase() : declared) {
    case "PSYCHOLOGIST":
      return UserRole.PSYCHOLOGIST;
    case "PATIENT":
      return UserRole.PATIENT;
    case "ADMIN":
      return UserRole.ADMIN;
    default:
      return undefined;
  }
};

/** El rol de negocio viaja en `app_metadata.role`, que el cliente no puede editar. */
interface SessionClaims extends JWTPayload {
  email?: string;
  app_metadata?: { role?: unknown };
}

export const verifyToken = async (token: string): Promise<AuthenticatedUser> => {
  let payload: SessionClaims;

  try {
    const verified = await jwtVerify<SessionClaims>(token, jwks, {
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
    });
    payload = verified.payload;
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      throw AppError.unauthorized("La sesión expiró, vuelve a iniciar sesión");
    }
    throw AppError.unauthorized("Token inválido");
  }

  if (!payload.sub) {
    throw AppError.unauthorized("Token inválido");
  }

  const role = toBusinessRole(payload.app_metadata?.role);

  // Fallo cerrado: una sesión válida sin rol de aplicación se rechaza. Degradar a
  // `UserRole.PATIENT` convertiría un token sin autorización en acceso de lectura
  // sobre datos clínicos.
  if (!role) {
    throw AppError.unauthorized("La sesión no declara un rol de aplicación");
  }

  return {
    id: payload.sub,
    email: payload.email ?? "",
    role,
  };
};
