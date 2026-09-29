import type { Session, User } from "@supabase/supabase-js";
import { UserRole, type SessionUser } from "@psicoagenda/shared";

/**
 * La sesión es la del proveedor de identidad. No hay token en `localStorage`: la
 * credencial de acceso vive en cookies httpOnly, fuera del alcance del JavaScript de
 * la página, y se renueva de forma transparente mientras la sesión siga vigente.
 */

const BUSINESS_ROLES: readonly string[] = Object.values(UserRole);

const readString = (value: unknown): string => (typeof value === "string" ? value : "");

const readUserMetadata = (user: User): Record<string, unknown> =>
  (user.user_metadata as Record<string, unknown> | undefined) ?? {};

/**
 * Identidad declarada por el proveedor. El rol viaja en `app_metadata`, que el cliente
 * no puede editar (a diferencia de `user_metadata`); el nombre proviene del perfil
 * espejado y el `id`/`email` del token.
 *
 * Devuelve `null` cuando la identidad no declara un `app_metadata.role` válido: quien
 * consume debe fallar cerrado en lugar de asumir el rol de menor privilegio.
 */
export function readIdentity(user: User | null): SessionUser | null {
  if (!user) return null;

  const role = (user.app_metadata as { role?: unknown } | undefined)?.role;
  if (typeof role !== "string" || !BUSINESS_ROLES.includes(role)) return null;

  const email = readString(user.email);
  const metadata = readUserMetadata(user);
  const name =
    readString(metadata.name) || readString(metadata.full_name) || email.split("@")[0];

  return { id: user.id, email, name, role: role as UserRole };
}

export function isSessionActive(session: Session | null): boolean {
  return session !== null;
}
