import { UserRole, type SessionUser } from "@psicoagenda/shared";
import { rol_usuario } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/app-error";

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
 */
export async function getProfileById(userId: string): Promise<SessionUser> {
  const user = await prisma.usuarios.findUnique({
    where: { id: userId },
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
    name: user.nombre_completo,
    role: toSessionRole(user.rol),
    photoUrl: user.foto_perfil_url ?? undefined,
  };
}
