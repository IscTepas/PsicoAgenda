import { UserRole } from "@psicoagenda/shared";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";

type FindUnique = (args: unknown) => Promise<{ id: string } | null>;

/**
 * Doble de `guardianship.service` para las suites de citas: sin tutores, un
 * paciente solo actúa sobre su propio registro (lo que el guard real decide
 * cuando no hay vínculos). La tutela tiene su propia suite.
 */
export function tutelaSinVinculos(pacientes: { findUnique: FindUnique }) {
  const propio = async (auth: AuthenticatedUser) =>
    pacientes.findUnique({ where: { usuario_id: auth.id }, select: { id: true } });

  return {
    patientIdsForUser: async (auth: AuthenticatedUser) => {
      const own = await propio(auth);
      return own ? [own.id] : [];
    },
    assertCanActOnPatient: async (auth: AuthenticatedUser, patientId: string) => {
      if (auth.role !== UserRole.PATIENT) return;
      const own = await propio(auth);
      if (own?.id !== patientId) throw AppError.forbidden("No puedes gestionar la agenda de este paciente");
    },
  };
}
