import { randomUUID } from "node:crypto";
import {
  AppointmentRequestStatus,
  UserRole,
  type Appointment,
  type AppointmentModality,
  type AppointmentRequest,
  CAMBIO_DE_FECHA_PREFIJO,
  getEffectiveDurationMinutes,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { estado_cita, estado_pago, estado_solicitud } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { TRANSACTION_OPTIONS } from "@/lib/transaction";
import { assertNoAgendaBlock } from "@/services/agenda-block.guard";
import { isPatientMinor } from "@/utils/age";
import { reasonIdsOf, reasonLinks, reasonOtherOf, reasonText, resolveReasons } from "@/services/consultation-reason.service";
import { assertCanActOnPatient, patientIdsForUser } from "@/services/guardianship.service";
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
const requestInclude = {
  citas: { select: { id: true } },
  cita_original: { select: { inicio: true } },
  solicitudes_motivos: reasonLinks,
} as const;

type RequestRow = Prisma.solicitudes_citaGetPayload<{ include: typeof requestInclude }>;

export interface CreateAppointmentRequestInput {
  /** Menor a cuyo nombre pide su tutor. */
  patientId?: string;
  startTime: Date;
  durationMinutes: number;
  modality: AppointmentModality;
  reason?: string;
  reasonIds?: string[];
}

export interface RescheduleAppointmentRequestInput extends CreateAppointmentRequestInput {
  changeReason?: string;
  appointmentId: string;
}

const motivoDeCambio = (motivo?: string) =>
  `${CAMBIO_DE_FECHA_PREFIJO}${motivo?.trim() || "solicitado por el paciente"}`;

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
  row: Pick<RequestRow, "id" | "paciente_id" | "psicologo_id" | "inicio_solicitado" | "duracion_minutos" | "modalidad">,
): CitaAviso => ({
  solicitudId: row.id,
  pacienteId: row.paciente_id,
  psicologoId: row.psicologo_id,
  inicio: row.inicio_solicitado,
  duracionMinutos: row.duracion_minutos,
  modalidad: row.modalidad,
});

/** Columnas de motivo de una solicitud: el texto de «Otro» y los enlaces al catálogo. */
const motivosDeSolicitud = ({ motivoIds, motivo }: { motivoIds: string[]; motivo: string | null }) => ({
  motivo,
  solicitudes_motivos: { create: motivoIds.map((motivo_id) => ({ motivo_id })) },
});

/** Si hay exactamente una psicóloga, se la asigna al paciente y devuelve su id; si no, null. */
async function assignSolePsychologist(patientId: string): Promise<string | null> {
  const psychologists = await prisma.psicologos.findMany({ select: { id: true }, take: 2 });
  if (psychologists.length !== 1) return null;
  const psychologistId = psychologists[0]!.id;
  await prisma.pacientes.update({ where: { id: patientId }, data: { psicologo_id: psychologistId } });
  return psychologistId;
}

const toAppointmentRequest = (row: RequestRow): AppointmentRequest => ({
  id: row.id,
  patientId: row.paciente_id,
  psychologistId: row.psicologo_id,
  startTime: row.inicio_solicitado,
  durationMinutes: row.duracion_minutos,
  modality: toSharedModality(row.modalidad),
  reason: reasonText(row.motivo, row.solicitudes_motivos),
  reasonIds: reasonIdsOf(row.solicitudes_motivos),
  reasonOther: reasonOtherOf(row.motivo, row.solicitudes_motivos),
  status: toSharedRequestStatus(row.estado),
  appointmentId: row.citas?.id,
  proposedByPsychologist: row.propuesta_por_psicologo,
  originalAppointmentId: row.cita_original_id ?? undefined,
  originalStartTime: row.cita_original?.inicio,
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
    where.paciente_id = { in: await patientIdsForUser(auth) };
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
  // Un tutor pide a nombre del menor; sin `patientId` la solicitud es propia.
  const patientId = input.patientId ?? (await requirePatientId(auth));
  if (input.patientId) await assertCanActOnPatient(auth, input.patientId);
  const patient = await prisma.pacientes.findUniqueOrThrow({
    where: { id: patientId },
    select: { id: true, psicologo_id: true, fecha_nacimiento: true },
  });

  // Red de seguridad: el registro ya asigna a la única psicóloga, pero un paciente
  // que haya quedado sin ella la recibe aquí en vez de no poder solicitar cita.
  if (!patient.psicologo_id) {
    patient.psicologo_id = await assignSolePsychologist(patientId);
  }
  if (!patient.psicologo_id) {
    throw AppError.badRequest("Aún no tienes un psicólogo asignado");
  }

  if (input.startTime.getTime() <= Date.now()) {
    throw AppError.badRequest("Elige un horario en el futuro");
  }

  const psychologistId = patient.psicologo_id;
  const start = input.startTime;
  // La duración la decide la edad del paciente (menores: 30 min), no lo que mande el formulario.
  const durationMinutes = getEffectiveDurationMinutes(isPatientMinor(patient.fecha_nacimiento), input.durationMinutes);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const created = await prisma
    .$transaction(async (tx) => {
    await assertNoOverlap(tx, { psychologistId, patientId, start, end });
    await assertNoAgendaBlock(tx, { psychologistId, start, end });

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
        duracion_minutos: durationMinutes,
        modalidad: toSchemaModality(input.modality),
        tipo_sesion: await resolveSessionType(tx, patientId),
        ...motivosDeSolicitud(
          await resolveReasons(tx, input.reasonIds, input.reason, isPatientMinor(patient.fecha_nacimiento)),
        ),
        solicitante_id: auth.id,
      },
      include: requestInclude,
    });
    })
    .catch((error: unknown) => {
      // Dos envíos simultáneos pasan el SELECT de arriba; el índice único
      // `uq_solicitudes_pendiente_por_horario` detiene al segundo.
      if ((error as { code?: string }).code === "P2002") {
        throw AppError.conflict("Ya tienes una solicitud pendiente para ese horario");
      }
      throw error;
    });

  await notificar("SOLICITUD_CREADA", avisoDeSolicitud(created));

  return toAppointmentRequest(created);
}

/**
 * Reagendamiento del paciente: cancela la cita actual y crea la solicitud del
 * nuevo horario en una sola transacción. No deja una cita cancelada sin
 * solicitud (ni al revés) si algo falla a mitad de camino.
 */
export async function rescheduleAppointmentRequest(
  auth: AuthenticatedUser,
  input: RescheduleAppointmentRequestInput,
): Promise<AppointmentRequest> {
  const start = input.startTime;

  if (start.getTime() <= Date.now()) {
    throw AppError.badRequest("Elige un horario en el futuro");
  }

  const current = await prisma.citas.findUnique({
    where: { id: input.appointmentId },
    select: {
      id: true,
      paciente_id: true,
      psicologo_id: true,
      inicio: true,
      fin: true,
      modalidad: true,
      estado: true,
    },
  });

  if (!current) {
    throw AppError.notFound("La cita no existe");
  }
  // El propio paciente o su tutor; la solicitud nueva queda a nombre del mismo paciente.
  await assertCanActOnPatient(auth, current.paciente_id);
  const patientId = current.paciente_id;
  if (current.estado === estado_cita.CANCELADA) {
    throw AppError.conflict("La cita ya está cancelada");
  }
  if (current.estado === estado_cita.COMPLETADA || current.estado === estado_cita.NO_ASISTIO) {
    throw AppError.conflict("La cita ya fue atendida");
  }
  if (current.fin.getTime() <= Date.now()) {
    throw AppError.conflict("Esta cita ya pasó y no se puede cambiar");
  }
  if (start.getTime() === current.inicio.getTime()) {
    throw AppError.badRequest("Elige un horario distinto al actual");
  }

  const patient = await prisma.pacientes.findUniqueOrThrow({
    where: { id: patientId },
    select: { psicologo_id: true, fecha_nacimiento: true },
  });
  if (!patient.psicologo_id) {
    throw AppError.badRequest("Aún no tienes un psicólogo asignado");
  }

  const psychologistId = current.psicologo_id;
  // La duración la decide la edad del paciente (menores: 30 min), no lo que mande el formulario.
  const durationMinutes = getEffectiveDurationMinutes(isPatientMinor(patient.fecha_nacimiento), input.durationMinutes);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Mismo tratamiento que cancelAppointment: se borra solo el honorario pendiente;
      // un pago ya cobrado se conserva como constancia.
      await tx.pagos_honorarios.deleteMany({ where: { cita_id: current.id, estado: estado_pago.PENDIENTE } });

      const cancelled = await tx.citas.updateMany({
        where: { id: current.id, estado: { not: estado_cita.CANCELADA } },
        data: {
          estado: estado_cita.CANCELADA,
          motivo_cancelacion: motivoDeCambio(input.changeReason),
          cancelada_por_id: auth.id,
          cancelada_en: new Date(),
        },
      });

      if (cancelled.count === 0) {
        throw AppError.conflict("La cita ya está cancelada");
      }

      // La cita acaba de quedar cancelada, así que el chequeo de solapes ya no
      // la cuenta como activa.
      await assertNoOverlap(tx, { psychologistId, patientId, start, end });
      await assertNoAgendaBlock(tx, { psychologistId, start, end });

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
          duracion_minutos: durationMinutes,
          modalidad: toSchemaModality(input.modality),
          tipo_sesion: await resolveSessionType(tx, patientId),
          ...motivosDeSolicitud(
            await resolveReasons(tx, input.reasonIds, input.reason, isPatientMinor(patient.fecha_nacimiento)),
          ),
          solicitante_id: auth.id,
        },
        include: requestInclude,
      });
    }, TRANSACTION_OPTIONS);

    await notificar(
      "CITA_CANCELADA_POR_PACIENTE",
      avisoDeCita(current, { motivoCancelacion: motivoDeCambio(input.changeReason) }),
    );
    await notificar("SOLICITUD_CREADA", avisoDeSolicitud(created));

    return toAppointmentRequest(created);
  } catch (error) {
    normalizeOverlapError(error);
  }
}

/** Carga la solicitud del psicólogo autenticado y exige que siga pendiente. */
async function requirePendingRequestOfPsychologist(
  tx: Prisma.TransactionClient,
  auth: AuthenticatedUser,
  id: string,
) {
  const row = await tx.solicitudes_cita.findUnique({
    where: { id },
    include: { pacientes: { select: { id: true, fecha_nacimiento: true } }, solicitudes_motivos: reasonLinks },
  });

  if (!row) {
    throw AppError.notFound("La solicitud no existe");
  }

  if (auth.role === UserRole.PATIENT) {
    throw AppError.forbidden("Solo el psicólogo puede responder una solicitud");
  }

  if (auth.role === UserRole.PSYCHOLOGIST && row.psicologo_id !== (await requirePsychologistId(auth, tx))) {
    throw AppError.forbidden("No puedes responder la solicitud de otro profesional");
  }

  if (row.estado !== estado_solicitud.PENDIENTE) {
    throw AppError.conflict("La solicitud ya fue atendida");
  }
  if (row.propuesta_por_psicologo) {
    throw AppError.conflict("Esta propuesta de cambio la responde el paciente");
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
        motivo: request.motivo,
        motivoIds: reasonIdsOf(request.solicitudes_motivos),
        status: estado_cita.CONFIRMADA,
        requestId: request.id,
      });
    }, TRANSACTION_OPTIONS);

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
  }, TRANSACTION_OPTIONS);

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

  if (auth.role !== UserRole.PATIENT) {
    throw AppError.forbidden("Solo puedes cancelar tus propias solicitudes");
  }
  if (row.propuesta_por_psicologo) {
    throw AppError.conflict("Es una propuesta de tu psicóloga: acéptala o recházala");
  }
  await assertCanActOnPatient(auth, row.paciente_id);

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

export interface ProponerCambioInput {
  appointmentId: string;
  startTime: Date;
  durationMinutes?: number;
  modality?: AppointmentModality;
}

/**
 * La psicóloga no mueve una cita por su cuenta: propone el nuevo horario y el
 * paciente lo acepta o lo rechaza. Mientras tanto la cita original sigue igual.
 */
export async function proponerCambio(auth: AuthenticatedUser, input: ProponerCambioInput): Promise<AppointmentRequest> {
  const cita = await prisma.citas.findUnique({
    where: { id: input.appointmentId },
    include: { pacientes: { select: { id: true, fecha_nacimiento: true } }, citas_motivos: true },
  });
  if (!cita) throw AppError.notFound("La cita no existe");
  if (auth.role === UserRole.PSYCHOLOGIST && cita.psicologo_id !== (await requirePsychologistId(auth))) {
    throw AppError.forbidden("No puedes modificar una cita de otro profesional");
  }
  if (cita.estado !== estado_cita.CONFIRMADA && cita.estado !== estado_cita.PENDIENTE) {
    throw AppError.conflict("Solo se puede cambiar una cita que sigue activa");
  }
  if (cita.fin.getTime() <= Date.now()) throw AppError.conflict("Esta cita ya pasó y no se puede cambiar");
  if (input.startTime.getTime() <= Date.now()) throw AppError.badRequest("Elige un horario en el futuro");
  if (input.startTime.getTime() === cita.inicio.getTime()) {
    throw AppError.badRequest("Elige un horario distinto al actual");
  }

  const pendiente = await prisma.solicitudes_cita.findFirst({
    where: { cita_original_id: cita.id, estado: estado_solicitud.PENDIENTE },
    select: { id: true },
  });
  if (pendiente) throw AppError.conflict("Ya hay una propuesta de cambio esperando respuesta del paciente");

  const durationMinutes = getEffectiveDurationMinutes(
    isPatientMinor(cita.pacientes.fecha_nacimiento),
    input.durationMinutes ?? Math.round((cita.fin.getTime() - cita.inicio.getTime()) / 60_000),
  );
  const end = new Date(input.startTime.getTime() + durationMinutes * 60_000);

  try {
    const created = await prisma.$transaction(async (tx) => {
      await assertNoOverlap(tx, {
        psychologistId: cita.psicologo_id,
        patientId: cita.paciente_id,
        start: input.startTime,
        end,
        excludeId: cita.id,
      });
      await assertNoAgendaBlock(tx, { psychologistId: cita.psicologo_id, start: input.startTime, end });
      return tx.solicitudes_cita.create({
        data: {
          id: randomUUID(),
          paciente_id: cita.paciente_id,
          psicologo_id: cita.psicologo_id,
          inicio_solicitado: input.startTime,
          duracion_minutos: durationMinutes,
          modalidad: input.modality ? toSchemaModality(input.modality) : cita.modalidad,
          tipo_sesion: cita.tipo_sesion,
          motivo: cita.motivo,
          solicitudes_motivos: { create: cita.citas_motivos.map((m) => ({ motivo_id: m.motivo_id })) },
          solicitante_id: auth.id,
          propuesta_por_psicologo: true,
          cita_original_id: cita.id,
        },
        include: requestInclude,
      });
    }, TRANSACTION_OPTIONS);

    await notificar("CAMBIO_PROPUESTO", avisoDeSolicitud(created));
    return toAppointmentRequest(created);
  } catch (error) {
    normalizeOverlapError(error);
  }
}

/**
 * El paciente (o su tutor) responde la propuesta. Aceptar cancela la cita
 * original y crea la nueva en una sola transacción; rechazar deja todo igual.
 */
export async function responderPropuesta(
  auth: AuthenticatedUser,
  id: string,
  accept: boolean,
): Promise<AppointmentRequest> {
  const request = await prisma.solicitudes_cita.findUnique({
    where: { id },
    include: { pacientes: { select: { id: true, fecha_nacimiento: true } }, solicitudes_motivos: reasonLinks },
  });
  if (!request || !request.propuesta_por_psicologo || !request.cita_original_id) {
    throw AppError.notFound("La propuesta no existe");
  }
  await assertCanActOnPatient(auth, request.paciente_id);
  if (request.estado !== estado_solicitud.PENDIENTE) throw AppError.conflict("La propuesta ya fue respondida");
  const originalId = request.cita_original_id;

  if (!accept) {
    const updated = await prisma.solicitudes_cita.update({
      where: { id },
      data: { estado: estado_solicitud.RECHAZADA, atendida_en: new Date() },
      include: requestInclude,
    });
    await notificar("CAMBIO_RECHAZADO", avisoDeSolicitud(updated));
    return toAppointmentRequest(updated);
  }

  if (request.inicio_solicitado.getTime() <= Date.now()) {
    throw AppError.conflict("El horario propuesto ya pasó; pide a tu psicóloga otro horario");
  }

  try {
    const nueva = await prisma.$transaction(async (tx) => {
      const claimed = await tx.solicitudes_cita.updateMany({
        where: { id, estado: estado_solicitud.PENDIENTE },
        data: { estado: estado_solicitud.ACEPTADA, atendida_en: new Date() },
      });
      if (claimed.count === 0) throw AppError.conflict("La propuesta ya fue respondida");

      // Igual que cancelar: se borra solo el honorario pendiente; un pago cobrado se conserva.
      await tx.pagos_honorarios.deleteMany({ where: { cita_id: originalId, estado: estado_pago.PENDIENTE } });
      const cancelada = await tx.citas.updateMany({
        where: { id: originalId, estado: { in: [estado_cita.CONFIRMADA, estado_cita.PENDIENTE] } },
        data: {
          estado: estado_cita.CANCELADA,
          motivo_cancelacion: `${CAMBIO_DE_FECHA_PREFIJO} propuesto por la psicóloga`,
          cancelada_por_id: auth.id,
          cancelada_en: new Date(),
        },
      });
      if (cancelada.count === 0) throw AppError.conflict("La cita original ya no está activa");

      return insertAppointment(tx, {
        psychologistId: request.psicologo_id,
        patient: request.pacientes,
        start: request.inicio_solicitado,
        durationMinutes: request.duracion_minutos,
        modality: toSharedModality(request.modalidad),
        motivo: request.motivo,
        motivoIds: reasonIdsOf(request.solicitudes_motivos),
        status: estado_cita.CONFIRMADA,
        requestId: request.id,
      });
    }, TRANSACTION_OPTIONS);

    await notificar("CAMBIO_ACEPTADO", avisoDeCita(nueva));
    return toAppointmentRequest(await prisma.solicitudes_cita.findUniqueOrThrow({ where: { id }, include: requestInclude }));
  } catch (error) {
    normalizeOverlapError(error);
  }
}
