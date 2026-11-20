import { randomUUID } from "node:crypto";
import {
  AppointmentModality as SharedModality,
  type SessionLogEntry,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { modalidad_cita } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";
import {
  ensureClinicalRecordId,
  requirePatientAccess,
  requirePsychologistId,
} from "@/services/clinical-record.service";
import { avisarTareas, syncTasks, toSessionTask, type TaskInput } from "@/services/task.service";

const logInclude = {
  citas: true,
  psicologos: { include: { usuarios: true } },
  expedientes_clinicos: { select: { paciente_id: true } },
  tareas_sesion: { orderBy: { orden: "asc" } },
} satisfies Prisma.entradas_bitacoraInclude;

type LogEntryRow = Prisma.entradas_bitacoraGetPayload<{ include: typeof logInclude }>;

const toSharedModality = (modality: modalidad_cita): SharedModality =>
  modality === modalidad_cita.VIRTUAL ? SharedModality.VIRTUAL : SharedModality.IN_PERSON;

/**
 * La interfaz numera las sesiones cronológicamente. El orden es
 * `(sessionDate, createdAt)`, igual que el que usa la consulta.
 */
function withSessionNumber(rows: LogEntryRow[]): SessionLogEntry[] {
  const ordered = [...rows].sort((a, b) => {
    const byDate = a.fecha_sesion.getTime() - b.fecha_sesion.getTime();
    if (byDate !== 0) return byDate;
    return a.creado_en.getTime() - b.creado_en.getTime();
  });

  const numberById = new Map(ordered.map((row, index) => [row.id, index + 1]));

  return ordered
    .map((row) => ({
      id: row.id,
      patientId: row.expedientes_clinicos.paciente_id,
      appointmentId: row.cita_id ?? undefined,
      sessionNumber: numberById.get(row.id) ?? 1,
      date: row.fecha_sesion,
      psychologistName: row.psicologos.usuarios.nombre_completo,
      modality: row.citas
        ? toSharedModality(row.citas.modalidad)
        : SharedModality.IN_PERSON,
      sessionType: row.estado_general ?? "Seguimiento terapéutico",
      notes: row.notas_sesion,
      interventions: row.objetivos_trabajados ?? undefined,
      homework: row.plan_proxima_sesion ?? undefined,
      tasks: row.tareas_sesion.map(toSessionTask),
      createdAt: row.creado_en,
      updatedAt: row.actualizado_en,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function listLogEntries(
  auth: AuthenticatedUser,
  patientId: string,
): Promise<SessionLogEntry[]> {
  await requirePatientAccess(auth, patientId);

  const record = await prisma.expedientes_clinicos.findUnique({
    where: { paciente_id: patientId },
    select: { id: true },
  });

  if (!record) return [];

  const rows = await prisma.entradas_bitacora.findMany({
    where: { expediente_id: record.id },
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
  tasks?: TaskInput[];
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
    const appointment = await prisma.citas.findUnique({
      where: { id: input.appointmentId },
      select: { inicio: true, paciente_id: true },
    });
    if (!appointment || appointment.paciente_id !== patientId) {
      throw AppError.badRequest("La cita asociada no corresponde al paciente");
    }
    sessionDate = appointment.inicio;

    // Cada sesión tiene una sola hoja: la segunda vez se edita la que ya existe.
    const previa = await prisma.entradas_bitacora.findFirst({
      where: { cita_id: input.appointmentId },
      select: { id: true },
    });
    if (previa) throw AppError.conflict("Esa sesión ya tiene su hoja de bitácora");
  }

  const entryId = randomUUID();
  let tareasNuevas: string[] = [];
  const created = await prisma.$transaction(async (tx) => {
    await tx.entradas_bitacora.create({
    data: {
      id: entryId,
      expediente_id: clinicalRecordId,
      cita_id: input.appointmentId ?? null,
      psicologo_id: psychologistId,
      fecha_sesion: sessionDate,
      notas_sesion: input.notes,
      objetivos_trabajados: emptyToNull(input.interventions),
      plan_proxima_sesion: emptyToNull(input.homework),
      estado_general: emptyToNull(input.sessionType),
    },
    });
    tareasNuevas = await syncTasks(tx, entryId, patientId, input.tasks ?? []);
    return { id: entryId };
  });
  await avisarTareas(patientId, tareasNuevas);

  const siblings = await prisma.entradas_bitacora.findMany({
    where: { expediente_id: clinicalRecordId },
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
  tasks?: TaskInput[];
}

export async function updateLogEntry(
  auth: AuthenticatedUser,
  id: string,
  input: UpdateLogEntryInput,
): Promise<SessionLogEntry> {
  const existing = await prisma.entradas_bitacora.findUnique({
    where: { id },
    include: logInclude,
  });

  if (!existing) {
    throw AppError.notFound("La nota de bitácora no existe");
  }

  await requirePatientAccess(auth, existing.expedientes_clinicos.paciente_id);

  const patientId = existing.expedientes_clinicos.paciente_id;
  let tareasNuevas: string[] = [];
  await prisma.$transaction(async (tx) => {
  await tx.entradas_bitacora.update({
    where: { id },
    data: {
      cita_id: input.appointmentId ?? undefined,
      notas_sesion: input.notes,
      objetivos_trabajados: input.interventions !== undefined ? emptyToNull(input.interventions) : undefined,
      plan_proxima_sesion: input.homework !== undefined ? emptyToNull(input.homework) : undefined,
      estado_general: input.sessionType !== undefined ? emptyToNull(input.sessionType) : undefined,
      version: { increment: 1 },
    },
  });
    if (input.tasks) tareasNuevas = await syncTasks(tx, id, patientId, input.tasks);
  });
  await avisarTareas(patientId, tareasNuevas);

  const siblings = await prisma.entradas_bitacora.findMany({
    where: { expediente_id: existing.expediente_id },
    include: logInclude,
  });

  return withSessionNumber(siblings).find((entry) => entry.id === id)!;
}
