import { UserRole, type SessionUser } from "@psicoagenda/shared";
import { UserRole as SchemaRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/app-error";

/**
 * El enum de Prisma usa las claves del enum de la base de datos (`PSYCHOLOGIST`) y el
 * de `packages/shared` los valores que viajan en las sesiones y la interfaz
 * (`psychologist`). La conversión es explícita: implicar que ambos coinciden por
 * nombre es justo el tipo de suposición que rompe la autorización.
 */
const toSessionRole = (role: SchemaRole): UserRole => {
  switch (role) {
    case SchemaRole.PSYCHOLOGIST:
      return UserRole.PSYCHOLOGIST;
    case SchemaRole.ADMIN:
      return UserRole.ADMIN;
    case SchemaRole.PATIENT:
      return UserRole.PATIENT;
  }
};

/**
 * Perfil del usuario autenticado, leído por el identificador de sesión (el `sub`
 * del token, que es el UUID de la identidad en el proveedor).
 *
 * La contraseña, el segundo factor y la verificación de correo no se consultan aquí:
 * los administra el proveedor de identidad y no se almacenan en este schema.
 */
export async function getProfileById(userId: string): Promise<SessionUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });

  if (!user) {
    throw AppError.unauthorized("El perfil no existe o fue eliminado");
  }

  if (!user.isActive) {
    throw AppError.forbidden("La cuenta está deshabilitada");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: toSessionRole(user.role),
  };
}
