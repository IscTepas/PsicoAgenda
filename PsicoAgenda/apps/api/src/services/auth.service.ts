import { UserRole, type SessionUser } from "@psicoagenda/shared";
import { rol_usuario } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";

/**
 * El enum de Prisma usa las claves del enum de la base de datos (`PSICOLOGO`) y el
 * de `packages/shared` los valores que viajan en las sesiones y la interfaz
 * (`psychologist`). La conversión es explícita: implicar que ambos coinciden por
 * nombre es justo el tipo de suposición que rompe la autorización.
 */
const toSessionRole = (role: rol_usuario): UserRole => {
  switch (role) {
    case rol_usuario.PSICOLOGO:
      return UserRole.PSYCHOLOGIST;
    case rol_usuario.ADMINISTRADOR:
      return UserRole.ADMIN;
    case rol_usuario.PACIENTE:
      return UserRole.PATIENT;
  }
};

/**
 * Perfil del usuario autenticado, leído por el identificador de sesión (el `sub`
 * del token, que es el UUID de la identidad en el proveedor).
 *
 * La contraseña, el segundo factor y la verificación de correo no se consultan aquí:
 * los administra el proveedor de identidad y no se almacenan en este schema.
 *
 * Si el token ya trae `name` y `photoUrl`, se usan directamente y la consulta a BD
 * solo valida que la cuenta siga activa. De lo contrario, se leen de la tabla
 * espejada.
 */
export async function getProfileById(
  tokenIdentity: AuthenticatedUser,
): Promise<SessionUser> {
  // Cuando los datos de perfil ya viajan en el token, la base de datos solo se
  // consulta para validar el estado `activo`. El nombre del token prevalece sobre
  // el espejado porque es el mismo valor que envió el proveedor de identidad.
  const needsDatabase = tokenIdentity.photoUrl === undefined;

  if (!needsDatabase) {
    const isActive = await prisma.usuarios.findUnique({
      where: { id: tokenIdentity.id },
      select: { activo: true },
    });

    if (!isActive) {
      throw AppError.unauthorized("El perfil no existe o fue eliminado");
    }

    if (!isActive.activo) {
      throw AppError.forbidden("La cuenta está deshabilitada");
    }

    return {
      id: tokenIdentity.id,
      email: tokenIdentity.email,
      name: tokenIdentity.name ?? "",
      role: tokenIdentity.role,
      photoUrl: tokenIdentity.photoUrl,
    };
  }

  const user = await prisma.usuarios.findUnique({
    where: { id: tokenIdentity.id },
    select: {
      id: true,
      correo: true,
      nombre_completo: true,
      rol: true,
      activo: true,
      foto_perfil_url: true,
    },
  });

  if (!user) {
    throw AppError.unauthorized("El perfil no existe o fue eliminado");
  }

  if (!user.activo) {
    throw AppError.forbidden("La cuenta está deshabilitada");
  }

  return {
    id: user.id,
    email: user.correo,
    name: tokenIdentity.name ?? user.nombre_completo,
    role: toSessionRole(user.rol),
    photoUrl: user.foto_perfil_url ?? undefined,
  };
}
