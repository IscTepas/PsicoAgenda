import { randomUUID } from "node:crypto";
import {
  AppointmentModality as SharedModality,
  AppointmentStatus as SharedStatus,
  AttendanceStatus,
  PaymentStatus,
  UserRole,
  type Appointment,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import {
  estado_cita,
  estado_pago,
  modalidad_cita,
  tipo_sesion,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";
import { calculateAppointmentPrice, getEffectiveDurationMinutes } from "@/utils/pricing";

// La cita viaja siempre con su fila de honorarios: el panel muestra si ya se cobró.
const appointmentInclude = { pagos_honorarios: true } as const;

type AppointmentRow = Prisma.citasGetPayload<{ include: typeof appointmentInclude }>;

export interface CreateAppointmentInput {
  psychologistId?: string;
  patientId: string;
  startTime: Date;
  durationMinutes: number;
  modality: SharedModality;
  reason?: string;
}

export interface UpdateAppointmentInput {
  startTime?: Date;
  durationMinutes?: number;
  modality?: SharedModality;
  reason?: string;
  notes?: string;
}

export interface ListAppointmentsFilter {
  from?: Date;
  to?: Date;
  patientId?: string;
  psychologistId?: string;
  status?: SharedStatus;
}

/**
 * El enum del esquema usa las claves de la base (`CONFIRMADA`) y el compartido los
 * valores que viajan en la interfaz (`confirmed`). La conversión es explícita en
 * ambos sentidos: el mismo concepto tiene dos vocabularios.
 */
const toSharedStatus = (status: estado_cita): SharedStatus => {
  switch (status) {
    case estado_cita.PENDIENTE:
      return SharedStatus.PENDING;
    case estado_cita.CONFIRMADA:
      return SharedStatus.CONFIRMED;
    case estado_cita.CANCELADA:
      return SharedStatus.CANCELLED;
    case estado_cita.COMPLETADA:
      return SharedStatus.COMPLETED;
    case estado_cita.NO_ASISTIO:
      return SharedStatus.NO_SHOW;
  }
};

const toSchemaStatus = (status: SharedStatus): estado_cita => {
  switch (status) {
    case SharedStatus.PENDING:
      return estado_cita.PENDIENTE;
    case SharedStatus.CONFIRMED:
      return estado_cita.CONFIRMADA;
    case SharedStatus.CANCELLED:
      return estado_cita.CANCELADA;
    case SharedStatus.COMPLETED:
      return estado_cita.COMPLETADA;
    case SharedStatus.NO_SHOW:
      return estado_cita.NO_ASISTIO;
  }
};

const toSharedModality = (modality: modalidad_cita): SharedModality => {
  switch (modality) {
    case modalidad_cita.PRESENCIAL:
      return SharedModality.IN_PERSON;
    case modalidad_cita.VIRTUAL:
      return SharedModality.VIRTUAL;
  }
};

const toSchemaModality = (modality: SharedModality): modalidad_cita => {
  switch (modality) {
    case SharedModality.IN_PERSON:
      return modalidad_cita.PRESENCIAL;
    case SharedModality.VIRTUAL:
      return modalidad_cita.VIRTUAL;
  }
};

const toSharedPaymentStatus = (status: estado_pago): PaymentStatus => {
  switch (status) {
    case estado_pago.PENDIENTE:
      return PaymentStatus.PENDING;
    case estado_pago.PAGADO:
      return PaymentStatus.PAID;
    case estado_pago.CONDONADO:
      return PaymentStatus.WAIVED;
  }
};

/** Solo se marca cobrado o condonado; `pending` es el estado inicial de la fila. */
const toSchemaPaymentStatus = (status: PaymentStatus): estado_pago => {
  switch (status) {
    case PaymentStatus.PENDING:
      return estado_pago.PENDIENTE;
    case PaymentStatus.PAID:
      return estado_pago.PAGADO;
    case PaymentStatus.WAIVED:
      return estado_pago.CONDONADO;
  }
};

/**
 * La asistencia no es una columna: se deriva del estado. Una cita completada se
 * asistió; una marcada como no presentada, no. Cualquier otro estado todavía no
 * tiene veredicto.
 */
const toAttendanceStatus = (status: estado_cita): AttendanceStatus | undefined => {
  switch (status) {
    case estado_cita.COMPLETADA:
      return AttendanceStatus.ATTENDED;
    case estado_cita.NO_ASISTIO:
      return AttendanceStatus.NO_SHOW;
    default:
      return undefined;
  }
};

const ACTIVE_STATUSES: estado_cita[] = [
  estado_cita.PENDIENTE,
  estado_cita.CONFIRMADA,
];

const durationOf = (start: Date, end: Date): number =>
  Math.round((end.getTime() - start.getTime()) / 60_000);

const toAppointment = (row: AppointmentRow): Appointment => {
  const payment = row.pagos_honorarios;

  return {
    id: row.id,
    psychologistId: row.psicologo_id,
    patientId: row.paciente_id,
    startTime: row.inicio,
    durationMinutes: durationOf(row.inicio, row.fin),
    status: toSharedStatus(row.estado),
    modality: toSharedModality(row.modalidad),
    attendanceStatus: toAttendanceStatus(row.estado),
    reason: row.motivo ?? undefined,
    notes: row.notas_internas ?? undefined,
    // `precio` es el snapshot de la tarifa; `payment` es el estado de cobro.
    price: row.precio ?? undefined,
    payment: payment
      ? {
          id: payment.id,
          appointmentId: payment.cita_id,
          // Decimal(12,2) viaja como string para no perder precisión en JSON.
          amount: payment.monto.toString(),
          status: toSharedPaymentStatus(payment.estado),
          paidAt: payment.pagado_en ?? undefined,
          createdAt: payment.creado_en,
          updatedAt: payment.actualizado_en,
        }
      : undefined,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
  };
};

/** Menor de edad: cumple 18 años en el futuro respecto a hoy. */
function isPatientMinor(birthDate: Date | null): boolean {
  if (!birthDate) return false;
  const turnsEighteen = new Date(birthDate);
  turnsEighteen.setFullYear(turnsEighteen.getFullYear() + 18);
  return turnsEighteen > new Date();
}

/**
 * El perfil de psicólogo cuelga del usuario y su identificador no viaja en la
 * sesión, así que se resuelve en cada petición.
 */
async function requirePsychologistId(auth: AuthenticatedUser): Promise<string> {
  const psychologist = await prisma.psicologos.findUnique({
    where: { usuario_id: auth.id },
    select: { id: true },
  });

  if (!psychologist) {
    throw AppError.forbidden("La cuenta no tiene perfil de psicólogo");
  }

  return psychologist.id;
}

async function requirePatientId(auth: AuthenticatedUser): Promise<string> {
  const patient = await prisma.pacientes.findUnique({
    where: { usuario_id: auth.id },
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

/**
 * Comprobación de solape en el mismo camino de la escritura. No sustituye al
 * `EXCLUDE` de la base (dos transacciones concurrentes pueden pasar aquí a la vez),
 * sino que da el mensaje en español antes de que el motor lance el 23P01.
 */
async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  params: { psychologistId: string; patientId: string; start: Date; end: Date; excludeId?: string },
): Promise<void> {
  const base: Prisma.citasWhereInput = {
    inicio: { lt: params.end },
    fin: { gt: params.start },
    estado: { in: ACTIVE_STATUSES },
  };

  if (params.excludeId) {
    base.id = { not: params.excludeId };
  }

  const psychologistClash = await tx.citas.findFirst({
    where: { ...base, psicologo_id: params.psychologistId },
    select: { id: true },
  });

  if (psychologistClash) {
    throw AppError.conflict("El psicólogo ya tiene una cita en ese horario");
  }

  const patientClash = await tx.citas.findFirst({
    where: { ...base, paciente_id: params.patientId },
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

export async function listAppointments(
  auth: AuthenticatedUser,
  filter: ListAppointmentsFilter,
): Promise<Appointment[]> {
  const where: Prisma.citasWhereInput = {};

  if (filter.status) {
    where.estado = toSchemaStatus(filter.status);
  }

  if (filter.from || filter.to) {
    where.inicio = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }

  if (filter.patientId) {
    where.paciente_id = filter.patientId;
  }

  if (filter.psychologistId) {
    where.psicologo_id = filter.psychologistId;
  }

  // El alcance por rol se aplica al final: gana sobre cualquier filtro del cliente,
  // de modo que un paciente no puede pedir las citas de otro ni un psicólogo las
  // suyas ajenas.
  if (auth.role === UserRole.PATIENT) {
    where.paciente_id = await requirePatientId(auth);
  } else if (auth.role === UserRole.PSYCHOLOGIST) {
    where.psicologo_id = await requirePsychologistId(auth);
  }

  const rows = await prisma.citas.findMany({
    where,
    orderBy: { inicio: "asc" },
    include: appointmentInclude,
  });

  return rows.map(toAppointment);
}

export async function getAppointmentById(id: string, auth: AuthenticatedUser): Promise<Appointment> {
  const row = await prisma.citas.findUnique({ where: { id }, include: appointmentInclude });

  if (!row) {
    throw AppError.notFound("La cita no existe");
  }

  if (auth.role === UserRole.PATIENT) {
    if (row.paciente_id !== (await requirePatientId(auth))) {
      throw AppError.forbidden("No puedes consultar la cita de otro paciente");
    }
  } else if (auth.role === UserRole.PSYCHOLOGIST) {
    if (row.psicologo_id !== (await requirePsychologistId(auth))) {
      throw AppError.forbidden("No puedes consultar una cita de otro profesional");
    }
  }

  return toAppointment(row);
}

export async function createAppointment(
  auth: AuthenticatedUser,
  input: CreateAppointmentInput,
): Promise<Appointment> {
  const patient = await prisma.pacientes.findUnique({
    where: { id: input.patientId },
    select: { id: true, psicologo_id: true, fecha_nacimiento: true },
  });

  if (!patient) {
    throw AppError.notFound("El paciente no existe");
  }

  if (auth.role === UserRole.PATIENT && input.patientId !== (await requirePatientId(auth))) {
    throw AppError.forbidden("Solo puedes agendar citas a tu nombre");
  }

  const psychologistId = await resolvePsychologistId(auth, input, patient.psicologo_id);

  // La primera cita del paciente es una consulta inicial; a partir de ahí, sesión
  // individual. No viaja como campo del formulario porque es una consecuencia, no
  // una elección.
  const previousAppointments = await prisma.citas.count({
    where: { paciente_id: patient.id, estado: { not: estado_cita.CANCELADA } },
  });
  const sessionType =
    previousAppointments === 0 ? tipo_sesion.CONSULTA_INICIAL : tipo_sesion.INDIVIDUAL;

  const start = input.startTime;

  // Reglas de precio: menores de edad solo 30 minutos y tarifa $1000; adultos
  // $800; +30% si la cita es el mismo día; −$100 por modalidad virtual.
  const isMinor = isPatientMinor(patient.fecha_nacimiento);
  const effectiveDuration = getEffectiveDurationMinutes(isMinor, input.durationMinutes);
  const end = new Date(start.getTime() + effectiveDuration * 60_000);
  const price = calculateAppointmentPrice({
    isMinor,
    startTime: start,
    modality: input.modality,
    durationMinutes: effectiveDuration,
  });

  try {
    const created = await prisma.$transaction(async (tx) => {
      await assertNoOverlap(tx, { psychologistId, patientId: patient.id, start, end });

      return tx.citas.create({
        data: {
          id: randomUUID(),
          psicologo_id: psychologistId,
          paciente_id: patient.id,
          inicio: start,
          fin: end,
          // La cita nace PENDIENTE: el profesional debe confirmarla manualmente.
          estado: estado_cita.PENDIENTE,
          modalidad: toSchemaModality(input.modality),
          tipo_sesion: sessionType,
          motivo: input.reason ?? null,
          precio: price,
          // El honorario nace con la cita, pendiente de cobro, por el precio calculado.
          pagos_honorarios: {
            create: {
              id: randomUUID(),
              monto: price,
              estado: estado_pago.PENDIENTE,
            },
          },
        },
        include: appointmentInclude,
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
  const row = await prisma.citas.findUnique({ where: { id }, include: appointmentInclude });

  if (!row) {
    throw AppError.notFound("La cita no existe");
  }

  if (auth.role === UserRole.PSYCHOLOGIST) {
    if (row.psicologo_id !== (await requirePsychologistId(auth))) {
      throw AppError.forbidden("No puedes modificar una cita de otro profesional");
    }
  } else if (auth.role === UserRole.PATIENT) {
    throw AppError.forbidden("No puedes modificar los datos de una cita");
  }

  const start = input.startTime ?? row.inicio;
  const durationMinutes = input.durationMinutes ?? durationOf(row.inicio, row.fin);
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Solo se comprueba el solape si la cita sigue ocupando agenda: una cancelada
      // tiene el horario libre por definición.
      if (ACTIVE_STATUSES.includes(row.estado)) {
        await assertNoOverlap(tx, {
          psychologistId: row.psicologo_id,
          patientId: row.paciente_id,
          start,
          end,
          excludeId: row.id,
        });
      }

      return tx.citas.update({
        where: { id },
        data: {
          inicio: start,
          fin: end,
          modalidad: input.modality ? toSchemaModality(input.modality) : undefined,
          motivo: input.reason,
          notas_internas: input.notes,
        },
        include: appointmentInclude,
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
  const row = await prisma.citas.findUnique({ where: { id }, include: appointmentInclude });

  if (!row) {
    throw AppError.notFound("La cita no existe");
  }

  if (auth.role === UserRole.PSYCHOLOGIST) {
    if (row.psicologo_id !== (await requirePsychologistId(auth))) {
      throw AppError.forbidden("No puedes modificar una cita de otro profesional");
    }
  } else if (auth.role === UserRole.PATIENT) {
    throw AppError.forbidden("No puedes cambiar el estado de una cita");
  }

  const updated = await prisma.citas.update({
    where: { id },
    data: { estado: toSchemaStatus(status) },
    include: appointmentInclude,
  });

  return toAppointment(updated);
}

export async function cancelAppointment(
  auth: AuthenticatedUser,
  id: string,
  reason: string,
): Promise<Appointment> {
  const row = await prisma.citas.findUnique({ where: { id }, include: appointmentInclude });

  if (!row) {
    throw AppError.notFound("La cita no existe");
  }

  if (auth.role === UserRole.PATIENT) {
    if (row.paciente_id !== (await requirePatientId(auth))) {
      throw AppError.forbidden("No puedes cancelar la cita de otro paciente");
    }
  } else if (auth.role === UserRole.PSYCHOLOGIST) {
    if (row.psicologo_id !== (await requirePsychologistId(auth))) {
      throw AppError.forbidden("No puedes cancelar una cita de otro profesional");
    }
  }

  if (row.estado === estado_cita.CANCELADA) {
    throw AppError.conflict("La cita ya está cancelada");
  }

  // El CHECK `ck_citas_cancelacion` exige motivo y marca de cancelación juntos. La
  // fila de honorarios se borra en la misma transacción: el enum no tiene estado
  // "cancelado", así que cancelar no debe dejar una deuda pendiente colgando.
  const updated = await prisma.$transaction(async (tx) => {
    await tx.pagos_honorarios.deleteMany({ where: { cita_id: id } });

    return tx.citas.update({
      where: { id },
      data: {
        estado: estado_cita.CANCELADA,
        motivo_cancelacion: reason,
        cancelada_por_id: auth.id,
        cancelada_en: new Date(),
      },
      include: appointmentInclude,
    });
  });

  return toAppointment(updated);
}

/**
 * Marca el honorario de una cita como cobrado o condonado. Solo lo hace el
 * psicólogo dueño de la cita (o el administrador). Las citas anteriores a la
 * tabla de pagos no tienen fila: se crea entonces con el estado pedido.
 */
export async function updateAppointmentPayment(
  auth: AuthenticatedUser,
  id: string,
  status: PaymentStatus,
): Promise<Appointment> {
  const row = await prisma.citas.findUnique({ where: { id }, include: appointmentInclude });

  if (!row) {
    throw AppError.notFound("La cita no existe");
  }

  if (auth.role === UserRole.PATIENT) {
    throw AppError.forbidden("No puedes modificar el estado de pago de una cita");
  }

  if (auth.role === UserRole.PSYCHOLOGIST) {
    if (row.psicologo_id !== (await requirePsychologistId(auth))) {
      throw AppError.forbidden("No puedes modificar una cita de otro profesional");
    }
  }

  if (row.estado === estado_cita.CANCELADA) {
    throw AppError.conflict("No se puede cobrar una cita cancelada");
  }

  // El CHECK `ck_pagos_fecha` exige `pagado_en` cuando el estado es PAGADO.
  const paidAt = status === PaymentStatus.PAID ? new Date() : null;
  const schemaStatus = toSchemaPaymentStatus(status);
  const existing = row.pagos_honorarios;

  const updated = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.pagos_honorarios.update({
        where: { cita_id: id },
        data: { estado: schemaStatus, pagado_en: paidAt },
      });
    } else {
      await tx.pagos_honorarios.create({
        data: {
          id: randomUUID(),
          cita_id: id,
          monto: row.precio ?? 0,
          estado: schemaStatus,
          pagado_en: paidAt,
        },
      });
    }

    return tx.citas.findUniqueOrThrow({ where: { id }, include: appointmentInclude });
  });

  return toAppointment(updated);
}
