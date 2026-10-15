import { randomUUID } from "node:crypto";
import {
  AppointmentModality as SharedModality,
  AppointmentStatus as SharedStatus,
  AttendanceStatus,
  UserRole,
  type Appointment,
} from "@psicoagenda/shared";
import {
  AppointmentModality,
  AppointmentStatus,
  SessionType,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";
import type {
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from "@/types/appointment";
import type { PrismaClient } from "@/generated/prisma/client";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

/**
 * El enum del esquema usa las claves de la base (`CONFIRMADA`) y el compartido los
 * valores que viajan en la interfaz (`confirmed`). La conversión es explícita en
 * ambos sentidos: el mismo concepto tiene dos vocabularios.
 */
const toSharedStatus = (status: AppointmentStatus): SharedStatus => {
  switch (status) {
    case AppointmentStatus.PENDING:
      return SharedStatus.PENDING;
    case AppointmentStatus.CONFIRMED:
      return SharedStatus.CONFIRMED;
    case AppointmentStatus.CANCELLED:
      return SharedStatus.CANCELLED;
    case AppointmentStatus.COMPLETED:
      return SharedStatus.COMPLETED;
    case AppointmentStatus.NO_SHOW:
      return SharedStatus.NO_SHOW;
  }
};

const toSchemaStatus = (status: SharedStatus): AppointmentStatus => {
  switch (status) {
    case SharedStatus.PENDING:
      return AppointmentStatus.PENDING;
    case SharedStatus.CONFIRMED:
      return AppointmentStatus.CONFIRMED;
    case SharedStatus.CANCELLED:
      return AppointmentStatus.CANCELLED;
    case SharedStatus.COMPLETED:
      return AppointmentStatus.COMPLETED;
    case SharedStatus.NO_SHOW:
      return AppointmentStatus.NO_SHOW;
  }
};

const toSharedModality = (modality: AppointmentModality): SharedModality => {
  switch (modality) {
    case AppointmentModality.IN_PERSON:
      return SharedModality.IN_PERSON;
    case AppointmentModality.VIRTUAL:
      return SharedModality.VIRTUAL;
  }
};

const toSchemaModality = (
  modality: SharedModality | "in_person" | "virtual",
): AppointmentModality => {
  switch (modality) {
    case SharedModality.IN_PERSON:
    case "in_person":
      return AppointmentModality.IN_PERSON;
    case SharedModality.VIRTUAL:
    case "virtual":
      return AppointmentModality.VIRTUAL;
  }
};

/**
 * La asistencia no es una columna: se deriva del estado. Una cita completada se
 * asistió; una marcada como no presentada, no. Cualquier otro estado todavía no
 * tiene veredicto.
 */
const toAttendanceStatus = (
  status: AppointmentStatus,
): AttendanceStatus | undefined => {
  switch (status) {
    case AppointmentStatus.COMPLETED:
      return AttendanceStatus.ATTENDED;
    case AppointmentStatus.NO_SHOW:
      return AttendanceStatus.NO_SHOW;
    default:
      return undefined;
  }
};

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

const durationOf = (start: Date, end: Date): number =>
  Math.round((end.getTime() - start.getTime()) / 60_000);

const toAppointment = (row: {
  id: string;
  psychologistId: string;
  patientId: string;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  modality: AppointmentModality;
  reason: string | null;
  internalNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Appointment => ({
  id: row.id,
  psychologistId: row.psychologistId,
  patientId: row.patientId,
  startTime: row.start,
  durationMinutes: durationOf(row.start, row.end),
  status: toSharedStatus(row.status),
  modality: toSharedModality(row.modality),
  attendanceStatus: toAttendanceStatus(row.status),
  reason: row.reason ?? undefined,
  notes: row.internalNotes ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * El perfil de psicólogo cuelga del usuario y su identificador no viaja en la
 * sesión, así que se resuelve en cada petición.
 */
async function requirePsychologistId(auth: AuthenticatedUser): Promise<string> {
  const psychologist = await prisma.psychologist.findUnique({
    where: { userId: auth.id },
    select: { id: true },
  });
  if (!psychologist) {
    throw AppError.forbidden("La cuenta no tiene perfil de psicólogo");
  }
  return psychologist.id;
}

async function requirePatientId(auth: AuthenticatedUser): Promise<string> {
  const patient = await prisma.patient.findUnique({
    where: { userId: auth.id },
    select: { id: true },
  });
  if (!patient) {
    throw AppError.forbidden("La cuenta no tiene perfil de paciente");
  }
  return patient.id;
}

/**
 * El psicólogo nunca lo elige el paciente: lo propone la sesión o lo hereda del
 * paciente. Solo el envío administrativo puede nombrar uno distinto.
 */
async function resolvePsychologistId(
  auth: AuthenticatedUser,
  input: CreateAppointmentInput,
  patientPsychologistId: string | null,
): Promise<string> {
  if (input.psychologistId) {
    if (auth.role === UserRole.PATIENT) {
      throw AppError.forbidden("No puedes elegir el psicólogo de la cita");
    }
    return input.psychologistId;
  }
  if (auth.role === UserRole.PSYCHOLOGIST) {
    return requirePsychologistId(auth);
  }
  if (patientPsychologistId) {
    return patientPsychologistId;
  }
  throw AppError.badRequest("No se pudo determinar el psicólogo de la cita");
}

interface OverlapParams {
  psychologistId: string;
  patientId: string;
  start: Date;
  end: Date;
  excludeId?: string;
}

/**
 * Comprobación de solape en el mismo camino de la escritura. No sustituye al
 * `EXCLUDE` de la base (dos transacciones concurrentes pueden pasar aquí a la vez),
 * sino que da el mensaje en español antes de que el motor lance el 23P01.
 */
async function assertNoOverlap(
  tx: TransactionClient,
  params: OverlapParams,
): Promise<void> {
  const base: Record<string, unknown> = {
    start: { lt: params.end },
    end: { gt: params.start },
    status: { in: ACTIVE_STATUSES },
  };
  if (params.excludeId) {
    base.id = { not: params.excludeId };
  }
  const psychologistClash = await tx.appointment.findFirst({
    where: { ...base, psychologistId: params.psychologistId },
    select: { id: true },
  });
  if (psychologistClash) {
    throw AppError.conflict("El psicólogo ya tiene una cita en ese horario");
  }
  const patientClash = await tx.appointment.findFirst({
    where: { ...base, patientId: params.patientId },
    select: { id: true },
  });
  if (patientClash) {
    throw AppError.conflict("El paciente ya tiene una cita en ese horario");
  }
}

/**
 * Convierte el fallo del constraint `EXCLUDE` en un 409 legible. La comprobación
 * previa no cubre la carrera entre dos peticiones simultáneas; esta es la red que
 * atrapa a la que pierde.
 */
function normalizeOverlapError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("excl_citas_psicologo_sin_empalme")) {
    throw AppError.conflict("El psicólogo ya tiene una cita en ese horario");
  }
  if (message.includes("excl_citas_paciente_sin_empalme")) {
    throw AppError.conflict("El paciente ya tiene una cita en ese horario");
  }
  throw error;
}

export interface AppointmentFilter {
  status?: SharedStatus;
  from?: Date;
  to?: Date;
  patientId?: string;
  psychologistId?: string;
}

export async function listAppointments(
  auth: AuthenticatedUser,
  filter: AppointmentFilter,
): Promise<Appointment[]> {
  const where: Record<string, unknown> = {};
  if (filter.status) {
    where.status = toSchemaStatus(filter.status);
  }
  if (filter.from || filter.to) {
    where.start = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }
  if (filter.patientId) {
    where.patientId = filter.patientId;
  }
  if (filter.psychologistId) {
    where.psychologistId = filter.psychologistId;
  }

  // El alcance por rol se aplica al final: gana sobre cualquier filtro del cliente,
  // de modo que un paciente no puede pedir las citas de otro ni un psicólogo las
  // suyas ajenas.
  if (auth.role === UserRole.PATIENT) {
    where.patientId = await requirePatientId(auth);
  } else if (auth.role === UserRole.PSYCHOLOGIST) {
    where.psychologistId = await requirePsychologistId(auth);
  }

  const rows = await prisma.appointment.findMany({
    where,
    orderBy: { start: "asc" },
  });
  return rows.map(toAppointment);
}

export async function getAppointmentById(
  id: string,
  auth: AuthenticatedUser,
): Promise<Appointment> {
  const row = await prisma.appointment.findUnique({ where: { id } });
  if (!row) {
    throw AppError.notFound("La cita no existe");
  }
  if (auth.role === UserRole.PATIENT) {
    if (row.patientId !== (await requirePatientId(auth))) {
      throw AppError.forbidden("No puedes consultar la cita de otro paciente");
    }
  } else if (auth.role === UserRole.PSYCHOLOGIST) {
    if (row.psychologistId !== (await requirePsychologistId(auth))) {
      throw AppError.forbidden(
        "No puedes consultar una cita de otro profesional",
      );
    }
  }
  return toAppointment(row);
}

export async function createAppointment(
  auth: AuthenticatedUser,
  input: CreateAppointmentInput,
): Promise<Appointment> {
  // Si un paciente agenda, siempre se agenda a sí mismo; el frontend puede no
  // conocer su propio patientId.
  const ownPatientId =
    auth.role === UserRole.PATIENT ? await requirePatientId(auth) : undefined;

  const patientId = ownPatientId ?? input.patientId;
  if (!patientId) {
    throw AppError.badRequest("El paciente es obligatorio");
  }

  if (
    auth.role === UserRole.PATIENT &&
    input.patientId &&
    input.patientId !== ownPatientId
  ) {
    throw AppError.forbidden("Solo puedes agendar citas a tu nombre");
  }

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true, psychologistId: true },
  });
  if (!patient) {
    throw AppError.notFound("El paciente no existe");
  }

  const psychologistId = await resolvePsychologistId(
    auth,
    input,
    patient.psychologistId,
  );

  // La primera cita del paciente es una consulta inicial; a partir de ahí, sesión
  // individual. No viaja como campo del formulario porque es una consecuencia, no
  // una elección.
  const previousAppointments = await prisma.appointment.count({
    where: {
      patientId: patient.id,
      status: { not: AppointmentStatus.CANCELLED },
    },
  });
  const sessionType =
    previousAppointments === 0
      ? SessionType.INITIAL_CONSULTATION
      : SessionType.INDIVIDUAL;

  const start = input.startTime;
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  try {
    const created = await prisma.$transaction(async (tx) => {
      await assertNoOverlap(tx, {
        psychologistId,
        patientId: patient.id,
        start,
        end,
      });
      return tx.appointment.create({
        data: {
          id: randomUUID(),
          psychologistId,
          patientId: patient.id,
          start,
          end,
          // El formulario nace en "confirmada": el psicólogo agenda sobre su propia
          // disponibilidad, no deja una reserva pendiente de aceptar.
          status: AppointmentStatus.CONFIRMED,
          modality: toSchemaModality(input.modality),
          sessionType,
          reason: input.reason ?? null,
        },
      });
    });
    return toAppointment(created);
  } catch (error) {
    normalizeOverlapError(error);
  }
}

export async function updateAppointment(
  auth: AuthenticatedUser,
  id: string,
  input: UpdateAppointmentInput,
): Promise<Appointment> {
  const row = await prisma.appointment.findUnique({ where: { id } });
  if (!row) {
    throw AppError.notFound("La cita no existe");
  }
  if (auth.role === UserRole.PSYCHOLOGIST) {
    if (row.psychologistId !== (await requirePsychologistId(auth))) {
      throw AppError.forbidden("No puedes modificar una cita de otro profesional");
    }
  } else if (auth.role === UserRole.PATIENT) {
    throw AppError.forbidden("No puedes modificar los datos de una cita");
  }

  const start = input.startTime ?? row.start;
  const durationMinutes =
    input.durationMinutes ?? durationOf(row.start, row.end);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Solo se comprueba el solape si la cita sigue ocupando agenda: una cancelada
      // tiene el horario libre por definición.
      if (ACTIVE_STATUSES.includes(row.status)) {
        await assertNoOverlap(tx, {
          psychologistId: row.psychologistId,
          patientId: row.patientId,
          start,
          end,
          excludeId: row.id,
        });
      }
      return tx.appointment.update({
        where: { id },
        data: {
          start,
          end,
          modality: input.modality
            ? toSchemaModality(input.modality)
            : undefined,
          reason: input.reason,
          internalNotes: input.notes,
        },
      });
    });
    return toAppointment(updated);
  } catch (error) {
    normalizeOverlapError(error);
  }
}

export async function changeAppointmentStatus(
  auth: AuthenticatedUser,
  id: string,
  status: SharedStatus,
): Promise<Appointment> {
  const row = await prisma.appointment.findUnique({ where: { id } });
  if (!row) {
    throw AppError.notFound("La cita no existe");
  }
  if (auth.role === UserRole.PSYCHOLOGIST) {
    if (row.psychologistId !== (await requirePsychologistId(auth))) {
      throw AppError.forbidden("No puedes modificar una cita de otro profesional");
    }
  } else if (auth.role === UserRole.PATIENT) {
    throw AppError.forbidden("No puedes cambiar el estado de una cita");
  }
  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: toSchemaStatus(status) },
  });
  return toAppointment(updated);
}

export async function cancelAppointment(
  auth: AuthenticatedUser,
  id: string,
  reason: string,
): Promise<Appointment> {
  const row = await prisma.appointment.findUnique({ where: { id } });
  if (!row) {
    throw AppError.notFound("La cita no existe");
  }
  if (auth.role === UserRole.PATIENT) {
    if (row.patientId !== (await requirePatientId(auth))) {
      throw AppError.forbidden("No puedes cancelar la cita de otro paciente");
    }
  } else if (auth.role === UserRole.PSYCHOLOGIST) {
    if (row.psychologistId !== (await requirePsychologistId(auth))) {
      throw AppError.forbidden(
        "No puedes cancelar una cita de otro profesional",
      );
    }
  }
  if (row.status === AppointmentStatus.CANCELLED) {
    throw AppError.conflict("La cita ya está cancelada");
  }

  // El CHECK `ck_citas_cancelacion` exige motivo y marca de cancelación juntos.
  const updated = await prisma.appointment.update({
    where: { id },
    data: {
      status: AppointmentStatus.CANCELLED,
      cancelReason: reason,
      cancelledById: auth.id,
      cancelledAt: new Date(),
    },
  });
  return toAppointment(updated);
}
