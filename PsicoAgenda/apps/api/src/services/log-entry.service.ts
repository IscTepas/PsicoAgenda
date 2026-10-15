import { randomUUID } from "node:crypto";
import {
  AppointmentModality as SharedModality,
  type SessionLogEntry,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { AppointmentModality } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";
import {
  ensureClinicalRecordId,
  requirePatientAccess,
  requirePsychologistId,
} from "@/services/clinical-record.service";

const logInclude = {
  appointment: true,
  psychologist: { include: { user: true } },
  clinicalRecord: { select: { patientId: true } },
} satisfies Prisma.LogEntryInclude;

type LogEntryRow = Prisma.LogEntryGetPayload<{ include: typeof logInclude }>;

const toSharedModality = (modality: AppointmentModality): SharedModality =>
  modality === AppointmentModality.VIRTUAL ? SharedModality.VIRTUAL : SharedModality.IN_PERSON;

/**
 * La interfaz numera las sesiones cronológicamente. El orden es
 * `(sessionDate, createdAt)`, igual que el que usa la consulta.
 */
function withSessionNumber(rows: LogEntryRow[]): SessionLogEntry[] {
  const ordered = [...rows].sort((a, b) => {
    const byDate = a.sessionDate.getTime() - b.sessionDate.getTime();
    if (byDate !== 0) return byDate;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const numberById = new Map(ordered.map((row, index) => [row.id, index + 1]));

  return ordered
    .map((row) => ({
      id: row.id,
      patientId: row.clinicalRecord.patientId,
      appointmentId: row.appointmentId ?? undefined,
      sessionNumber: numberById.get(row.id) ?? 1,
      date: row.sessionDate,
      psychologistName: row.psychologist.user.name,
      modality: row.appointment
        ? toSharedModality(row.appointment.modality)
        : SharedModality.IN_PERSON,
      sessionType: row.generalState ?? "Seguimiento terapéutico",
      notes: row.sessionNotes,
      interventions: row.objectives ?? undefined,
      homework: row.nextSessionPlan ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function listLogEntries(
  auth: AuthenticatedUser,
  patientId: string,
): Promise<SessionLogEntry[]> {
  await requirePatientAccess(auth, patientId);

  const record = await prisma.clinicalRecord.findUnique({
    where: { patientId },
    select: { id: true },
  });

  if (!record) return [];

  const rows = await prisma.logEntry.findMany({
    where: { clinicalRecordId: record.id },
    include: logInclude,
  });

  return withSessionNumber(rows);
}

export interface CreateLogEntryInput {
  appointmentId?: string;
  sessionType?: string;
  notes: string;
  interventions?: string;
  homework?: string;
}

const emptyToNull = (value: string | undefined): string | null =>
  value === undefined || value.trim() === "" ? null : value;

export async function createLogEntry(
  auth: AuthenticatedUser,
  patientId: string,
  input: CreateLogEntryInput,
): Promise<SessionLogEntry> {
  await requirePatientAccess(auth, patientId);
  const psychologistId = await requirePsychologistId(auth);
  const clinicalRecordId = await ensureClinicalRecordId(patientId);

  // La fecha de la sesión es la de la cita asociada; sin cita, el momento actual.
  let sessionDate = new Date();
  if (input.appointmentId) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: input.appointmentId },
      select: { start: true, patientId: true },
    });
    if (!appointment || appointment.patientId !== patientId) {
      throw AppError.badRequest("La cita asociada no corresponde al paciente");
    }
    sessionDate = appointment.start;
  }

  const created = await prisma.logEntry.create({
    data: {
      id: randomUUID(),
      clinicalRecordId,
      appointmentId: input.appointmentId ?? null,
      psychologistId,
      sessionDate,
      sessionNotes: input.notes,
      objectives: emptyToNull(input.interventions),
      nextSessionPlan: emptyToNull(input.homework),
      generalState: emptyToNull(input.sessionType),
    },
    include: logInclude,
  });

  const siblings = await prisma.logEntry.findMany({
    where: { clinicalRecordId },
    include: logInclude,
  });

  return withSessionNumber(siblings).find((entry) => entry.id === created.id)!;
}

export interface UpdateLogEntryInput {
  appointmentId?: string;
  sessionType?: string;
  notes?: string;
  interventions?: string;
  homework?: string;
}

export async function updateLogEntry(
  auth: AuthenticatedUser,
  id: string,
  input: UpdateLogEntryInput,
): Promise<SessionLogEntry> {
  const existing = await prisma.logEntry.findUnique({
    where: { id },
    include: logInclude,
  });

  if (!existing) {
    throw AppError.notFound("La nota de bitácora no existe");
  }

  await requirePatientAccess(auth, existing.clinicalRecord.patientId);

  await prisma.logEntry.update({
    where: { id },
    data: {
      appointmentId: input.appointmentId ?? undefined,
      sessionNotes: input.notes,
      objectives: input.interventions !== undefined ? emptyToNull(input.interventions) : undefined,
      nextSessionPlan: input.homework !== undefined ? emptyToNull(input.homework) : undefined,
      generalState: input.sessionType !== undefined ? emptyToNull(input.sessionType) : undefined,
      version: { increment: 1 },
    },
  });

  const siblings = await prisma.logEntry.findMany({
    where: { clinicalRecordId: existing.clinicalRecordId },
    include: logInclude,
  });

  return withSessionNumber(siblings).find((entry) => entry.id === id)!;
}
