import { randomUUID } from "node:crypto";
import {
  RecordStatus as SharedRecordStatus,
  UserRole,
  type ClinicalRecord,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { RecordStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";

type ClinicalRecordRow = Prisma.ClinicalRecordModel;

const toSharedRecordStatus = (status: RecordStatus): SharedRecordStatus => {
  switch (status) {
    case RecordStatus.ACTIVE:
      return SharedRecordStatus.ACTIVE;
    case RecordStatus.INACTIVE:
      return SharedRecordStatus.INACTIVE;
  }
};

const toClinicalRecord = (row: ClinicalRecordRow): ClinicalRecord => ({
  id: row.id,
  patientId: row.patientId,
  openedAt: row.openedAt,
  diagnosis: row.diagnosis ?? undefined,
  background: row.background ?? undefined,
  generalObservations: row.generalObservations ?? undefined,
  status: toSharedRecordStatus(row.status),
  updatedAt: row.updatedAt,
});

/**
 * Identificador del perfil de psicólogo de la sesión. El `id` del perfil no viaja
 * en el token, así que se resuelve contra la base en cada petición.
 */
export async function requirePsychologistId(auth: AuthenticatedUser): Promise<string> {
  const psychologist = await prisma.psychologist.findUnique({
    where: { userId: auth.id },
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

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, psychologistId: true },
  });

  if (!patient) {
    throw AppError.notFound("El paciente no existe");
  }

  if (auth.role === UserRole.PSYCHOLOGIST) {
    const psychologistId = await requirePsychologistId(auth);
    if (patient.psychologistId !== psychologistId) {
      throw AppError.forbidden("El paciente pertenece a otro profesional");
    }
  }

  return { patientId: patient.id, psychologistId: patient.psychologistId };
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

  const existing = await prisma.clinicalRecord.findUnique({ where: { patientId } });
  if (existing) return toClinicalRecord(existing);

  const created = await prisma.clinicalRecord.create({
    data: { id: randomUUID(), patientId },
  });

  return toClinicalRecord(created);
}

/** Identificador del expediente, creándolo si no existe (uso interno de bitácora). */
export async function ensureClinicalRecordId(patientId: string): Promise<string> {
  const existing = await prisma.clinicalRecord.findUnique({
    where: { patientId },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.clinicalRecord.create({
    data: { id: randomUUID(), patientId },
    select: { id: true },
  });

  return created.id;
}
