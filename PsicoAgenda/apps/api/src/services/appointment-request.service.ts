import { randomUUID } from "node:crypto";
import {
  AppointmentRequestStatus,
  UserRole,
  type Appointment,
  type AppointmentModality,
  type AppointmentRequest,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { estado_cita, estado_solicitud } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";
import { notificar, type CitaAviso } from "@/services/notification.service";
import {
  assertNoOverlap,
  avisoDeCita,
  insertAppointment,
  normalizeOverlapError,
  requirePatientId,
  requirePsychologistId,
  resolveSessionType,
  toAppointment,
  toSchemaModality,
  toSharedModality,
} from "@/services/appointment.service";

// La relación 1:1 con la cita creada al aceptar viaja con la solicitud.
const requestInclude = { citas: { select: { id: true } } } as const;

type RequestRow = Prisma.solicitudes_citaGetPayload<{ include: typeof requestInclude }>;

export interface CreateAppointmentRequestInput {
  startTime: Date;
  durationMinutes: number;
  modality: AppointmentModality;
  reason?: string;
}

const toSharedRequestStatus = (status: estado_solicitud): AppointmentRequestStatus => {
  switch (status) {
    case estado_solicitud.PENDIENTE:
      return AppointmentRequestStatus.PENDING;
    case estado_solicitud.ACEPTADA:
      return AppointmentRequestStatus.ACCEPTED;
    case estado_solicitud.RECHAZADA:
      return AppointmentRequestStatus.REJECTED;
    case estado_solicitud.CANCELADA:
      return AppointmentRequestStatus.CANCELLED;
  }
};

const toSchemaRequestStatus = (status: AppointmentRequestStatus): estado_solicitud => {
  switch (status) {
    case AppointmentRequestStatus.PENDING:
      return estado_solicitud.PENDIENTE;
    case AppointmentRequestStatus.ACCEPTED:
      return estado_solicitud.ACEPTADA;
    case AppointmentRequestStatus.REJECTED:
      return estado_solicitud.RECHAZADA;
    case AppointmentRequestStatus.CANCELLED:
      return estado_solicitud.CANCELADA;
  }
};

const avisoDeSolicitud = (
  row: Pick<RequestRow, "paciente_id" | "psicologo_id" | "inicio_solicitado" | "duracion_minutos" | "modalidad">,
): CitaAviso => ({
  pacienteId: row.paciente_id,
  psicologoId: row.psicologo_id,
  inicio: row.inicio_solicitado,
  duracionMinutos: row.duracion_minutos,
  modalidad: row.modalidad,
});

const toAppointmentRequest = (row: RequestRow): AppointmentRequest => ({
  id: row.id,
  patientId: row.paciente_id,
  psychologistId: row.psicologo_id,
  startTime: row.inicio_solicitado,
  durationMinutes: row.duracion_minutos,
  modality: toSharedModality(row.modalidad),
  reason: row.motivo ?? undefined,
  status: toSharedRequestStatus(row.estado),
  appointmentId: row.citas?.id,
  createdAt: row.creado_en,
  handledAt: row.atendida_en ?? undefined,
});

export async function listAppointmentRequests(
  auth: AuthenticatedUser,
  filter: { status?: AppointmentRequestStatus },
): Promise<AppointmentRequest[]> {
  const where: Prisma.solicitudes_citaWhereInput = {};

  if (filter.status) {
    where.estado = toSchemaRequestStatus(filter.status);
  }

  // Igual que en citas: el alcance por rol gana sobre cualquier filtro del cliente.
  if (auth.role === UserRole.PATIENT) {
    where.paciente_id = await requirePatientId(auth);
  } else if (auth.role === UserRole.PSYCHOLOGIST) {
    where.psicologo_id = await requirePsychologistId(auth);
  }

  const rows = await prisma.solicitudes_cita.findMany({
    where,
    orderBy: { inicio_solicitado: "asc" },
    include: requestInclude,
  });

  return rows.map(toAppointmentRequest);
}

/**
 * El paciente pide un horario. La solicitud no ocupa agenda, pero se rechaza de
 * entrada si el hueco ya está tomado por una cita: no tiene sentido pedirlo.
 */
export async function createAppointmentRequest(
  auth: AuthenticatedUser,
  input: CreateAppointmentRequestInput,
): Promise<AppointmentRequest> {
  const patientId = await requirePatientId(auth);
  const patient = await prisma.pacientes.findUniqueOrThrow({
    where: { id: patientId },
    select: { id: true, psicologo_id: true },
  });

  if (!patient.psicologo_id) {
    throw AppError.badRequest("Aún no tienes un psicólogo asignado");
  }

  if (input.startTime.getTime() <= Date.now()) {
    throw AppError.badRequest("Elige un horario en el futuro");
  }

  const psychologistId = patient.psicologo_id;
  const start = input.startTime;
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  const created = await prisma.$transaction(async (tx) => {
    await assertNoOverlap(tx, { psychologistId, patientId, start, end });

    const duplicate = await tx.solicitudes_cita.findFirst({
      where: { paciente_id: patientId, inicio_solicitado: start, estado: estado_solicitud.PENDIENTE },
      select: { id: true },
    });
    if (duplicate) {
      throw AppError.conflict("Ya tienes una solicitud pendiente para ese horario");
    }

    return tx.solicitudes_cita.create({
      data: {
        id: randomUUID(),
        paciente_id: patientId,
        psicologo_id: psychologistId,
        inicio_solicitado: start,
        duracion_minutos: input.durationMinutes,
        modalidad: toSchemaModality(input.modality),
        tipo_sesion: await resolveSessionType(tx, patientId),
        motivo: input.reason?.trim() || null,
      },
      include: requestInclude,
    });
  });

  await notificar("SOLICITUD_CREADA", avisoDeSolicitud(created));

  return toAppointmentRequest(created);
}

/** Carga la solicitud del psicólogo autenticado y exige que siga pendiente. */
async function requirePendingRequestOfPsychologist(
  tx: Prisma.TransactionClient,
  auth: AuthenticatedUser,
  id: string,
) {
  const row = await tx.solicitudes_cita.findUnique({
    where: { id },
    include: { pacientes: { select: { id: true, fecha_nacimiento: true } } },
  });

  if (!row) {
    throw AppError.notFound("La solicitud no existe");
  }

  if (auth.role === UserRole.PATIENT) {
    throw AppError.forbidden("Solo el psicólogo puede responder una solicitud");
  }

  if (auth.role === UserRole.PSYCHOLOGIST && row.psicologo_id !== (await requirePsychologistId(auth))) {
    throw AppError.forbidden("No puedes responder la solicitud de otro profesional");
  }

  if (row.estado !== estado_solicitud.PENDIENTE) {
    throw AppError.conflict("La solicitud ya fue atendida");
  }

  return row;
}

/**
 * Aceptar crea la cita (ya CONFIRMADA, ligada a la solicitud) y cierra la
 * solicitud en la misma transacción: o pasan las dos cosas o ninguna.
 */
export async function acceptAppointmentRequest(
  auth: AuthenticatedUser,
  id: string,
): Promise<Appointment> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const request = await requirePendingRequestOfPsychologist(tx, auth, id);

      if (request.inicio_solicitado.getTime() <= Date.now()) {
        throw AppError.conflict("El horario solicitado ya pasó; rechaza la solicitud");
      }

      // Solo una transacción puede pasar de PENDIENTE a ACEPTADA: si otra la ganó,
      // `count` es 0 y esta se detiene antes de crear una segunda cita.
      const claimed = await tx.solicitudes_cita.updateMany({
        where: { id, estado: estado_solicitud.PENDIENTE },
        data: { estado: estado_solicitud.ACEPTADA, atendida_en: new Date() },
      });
      if (claimed.count === 0) {
        throw AppError.conflict("La solicitud ya fue atendida");
      }

      return insertAppointment(tx, {
        psychologistId: request.psicologo_id,
        patient: request.pacientes,
        start: request.inicio_solicitado,
        durationMinutes: request.duracion_minutos,
        modality: toSharedModality(request.modalidad),
        reason: request.motivo,
        status: estado_cita.CONFIRMADA,
        requestId: request.id,
      });
    });

    await notificar("SOLICITUD_ACEPTADA", avisoDeCita(created));

    return toAppointment(created);
  } catch (error) {
    normalizeOverlapError(error);
  }
}

export async function rejectAppointmentRequest(
  auth: AuthenticatedUser,
  id: string,
): Promise<AppointmentRequest> {
  const updated = await prisma.$transaction(async (tx) => {
    await requirePendingRequestOfPsychologist(tx, auth, id);
    return tx.solicitudes_cita.update({
      where: { id },
      data: { estado: estado_solicitud.RECHAZADA, atendida_en: new Date() },
      include: requestInclude,
    });
  });

  await notificar("SOLICITUD_RECHAZADA", avisoDeSolicitud(updated));

  return toAppointmentRequest(updated);
}

/** El paciente retira su propia solicitud mientras siga pendiente. */
export async function cancelAppointmentRequest(
  auth: AuthenticatedUser,
  id: string,
): Promise<AppointmentRequest> {
  const row = await prisma.solicitudes_cita.findUnique({ where: { id } });

  if (!row) {
    throw AppError.notFound("La solicitud no existe");
  }

  if (auth.role !== UserRole.PATIENT || row.paciente_id !== (await requirePatientId(auth))) {
    throw AppError.forbidden("Solo puedes cancelar tus propias solicitudes");
  }

  if (row.estado !== estado_solicitud.PENDIENTE) {
    throw AppError.conflict("La solicitud ya fue atendida");
  }

  const updated = await prisma.solicitudes_cita.update({
    where: { id },
    data: { estado: estado_solicitud.CANCELADA, atendida_en: new Date() },
    include: requestInclude,
  });

  await notificar("SOLICITUD_CANCELADA", avisoDeSolicitud(updated));

  return toAppointmentRequest(updated);
}
