import { randomUUID } from "node:crypto";
import {
  RecordStatus as SharedRecordStatus,
  UserRole,
  type ClinicalRecord,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { estado_expediente } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";

type ClinicalRecordRow = Prisma.expedientes_clinicosModel;

const toSharedRecordStatus = (status: estado_expediente): SharedRecordStatus => {
  switch (status) {
    case estado_expediente.ACTIVO:
      return SharedRecordStatus.ACTIVE;
    case estado_expediente.INACTIVO:
      return SharedRecordStatus.INACTIVE;
  }
};

const toClinicalRecord = (row: ClinicalRecordRow): ClinicalRecord => ({
  id: row.id,
  patientId: row.paciente_id,
  openedAt: row.abierto_en,
  diagnosis: row.diagnostico ?? undefined,
  background: row.antecedentes ?? undefined,
  generalObservations: row.observaciones_generales ?? undefined,
  status: toSharedRecordStatus(row.estado),
  updatedAt: row.actualizado_en,
});

/**
 * Identificador del perfil de psicólogo de la sesión. El `id` del perfil no viaja
 * en el token, así que se resuelve contra la base en cada petición.
 */
export async function requirePsychologistId(auth: AuthenticatedUser): Promise<string> {
  const psychologist = await prisma.psicologos.findUnique({
    where: { usuario_id: auth.id },
    select: { id: true },
  });

  if (!psychologist) {
    throw AppError.forbidden("La cuenta no tiene perfil de psicólogo");
  }

  return psychologist.id;
}

/**
 * Comprueba que la sesión puede operar sobre el expediente del paciente: el
 * psicólogo dueño del paciente o un administrador. El paciente no accede al
 * expediente clínico (la interfaz tampoco lo expone).
 */
export async function requirePatientAccess(
  auth: AuthenticatedUser,
  patientId: string,
): Promise<{ patientId: string; psychologistId: string | null }> {
  if (auth.role === UserRole.PATIENT) {
    throw AppError.forbidden("No tienes acceso al expediente clínico");
  }

  const patient = await prisma.pacientes.findUnique({
    where: { id: patientId },
    select: { id: true, psicologo_id: true },
  });

  if (!patient) {
    throw AppError.notFound("El paciente no existe");
  }

  if (auth.role === UserRole.PSYCHOLOGIST) {
    const psychologistId = await requirePsychologistId(auth);
    if (patient.psicologo_id !== psychologistId) {
      throw AppError.forbidden("El paciente pertenece a otro profesional");
    }
  }

  return { patientId: patient.id, psychologistId: patient.psicologo_id };
}

/**
 * Devuelve el expediente del paciente, creándolo de forma perezosa si aún no
 * existe. El expediente nace con los datos que ya se conocen del paciente.
 */
export async function getOrCreateClinicalRecord(
  auth: AuthenticatedUser,
  patientId: string,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);

  const existing = await prisma.expedientes_clinicos.findUnique({ where: { paciente_id: patientId } });
  if (existing) return toClinicalRecord(existing);

  const created = await prisma.expedientes_clinicos.create({
    data: { id: randomUUID(), paciente_id: patientId },
  });

  return toClinicalRecord(created);
}

/** Identificador del expediente, creándolo si no existe (uso interno de bitácora). */
export async function ensureClinicalRecordId(patientId: string): Promise<string> {
  const existing = await prisma.expedientes_clinicos.findUnique({
    where: { paciente_id: patientId },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.expedientes_clinicos.create({
    data: { id: randomUUID(), paciente_id: patientId },
    select: { id: true },
  });

  return created.id;
}
