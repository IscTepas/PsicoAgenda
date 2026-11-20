import { randomUUID } from "node:crypto";
import { UserRole, type AgendaBlock } from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { patientIdsForUser } from "@/services/guardianship.service";
import { requirePsychologistIdByUser } from "@/services/psychologist.service";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";

const blockSelect = {
  id: true,
  psicologo_id: true,
  fecha_inicio: true,
  fecha_fin: true,
  todo_el_dia: true,
  motivo: true,
  creado_en: true,
  actualizado_en: true,
} satisfies Prisma.bloqueos_agendaSelect;

type BlockRow = Prisma.bloqueos_agendaGetPayload<{ select: typeof blockSelect }>;

/** La API habla camelCase; la tabla conserva el vocabulario en español. */
function toAgendaBlock(row: BlockRow): AgendaBlock {
  return {
    id: row.id,
    psychologistId: row.psicologo_id,
    startTime: row.fecha_inicio,
    endTime: row.fecha_fin,
    allDay: row.todo_el_dia,
    reason: row.motivo ?? undefined,
    createdAt: row.creado_en,
    updatedAt: row.actualizado_en,
  };
}

export interface CreateAgendaBlockInput {
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  reason?: string;
}

export interface ListAgendaBlocksFilter {
  from?: Date;
  to?: Date;
  /** Alias de `from` aceptado por comodidad de los clientes. */
  startDate?: Date;
  /** Alias de `to`. */
  endDate?: Date;
  /** Solo lo usa la administración; el resto de roles queda acotado por sesión. */
  psychologistId?: string;
}

export async function createAgendaBlock(
  auth: AuthenticatedUser,
  input: CreateAgendaBlockInput,
): Promise<AgendaBlock> {
  if (auth.role !== UserRole.PSYCHOLOGIST) {
    throw AppError.forbidden("Solo el psicólogo puede bloquear su agenda");
  }

  // El perfil sale de la sesión, nunca del cuerpo: un psicólogo no puede crear
  // bloqueos a nombre de otro.
  const psychologistId = await requirePsychologistIdByUser(auth.id);

  if (input.endTime.getTime() <= input.startTime.getTime()) {
    throw AppError.badRequest("La fecha de fin debe ser posterior al inicio");
  }

  const reason = input.reason?.trim() || null;

  try {
    const row = await prisma.bloqueos_agenda.create({
      data: {
        id: randomUUID(),
        psicologo_id: psychologistId,
        fecha_inicio: input.startTime,
        fecha_fin: input.endTime,
        todo_el_dia: input.allDay ?? false,
        motivo: reason,
      },
      select: blockSelect,
    });

    return toAgendaBlock(row);
  } catch (error) {
    normalizeAgendaBlockError(error);
  }
}

export async function listAgendaBlocks(
  auth: AuthenticatedUser,
  filter: ListAgendaBlocksFilter,
): Promise<AgendaBlock[]> {
  const from = filter.from ?? filter.startDate;
  const to = filter.to ?? filter.endDate;

  if (!from || !to) {
    throw AppError.badRequest("Indica el rango de fechas (from/to o startDate/endDate)");
  }

  if (to.getTime() <= from.getTime()) {
    throw AppError.badRequest("El rango de fechas no es válido");
  }

  const where: Prisma.bloqueos_agendaWhereInput = {
    fecha_inicio: { lt: to },
    fecha_fin: { gt: from },
  };

  if (auth.role === UserRole.PSYCHOLOGIST) {
    where.psicologo_id = await requirePsychologistIdByUser(auth.id);
  } else if (auth.role === UserRole.PATIENT) {
    // El paciente (o su tutor) ve la disponibilidad del psicólogo que lo atiende.
    const patientIds = await patientIdsForUser(auth);
    if (patientIds.length === 0) return [];

    const psychologists = await prisma.pacientes.findMany({
      where: { id: { in: patientIds }, psicologo_id: { not: null } },
      select: { psicologo_id: true },
    });
    const psychologistIds = [
      ...new Set(
        psychologists
          .map((row) => row.psicologo_id)
          .filter((id): id is string => id !== null),
      ),
    ];

    if (psychologistIds.length === 0) return [];
    where.psicologo_id = { in: psychologistIds };
  } else {
    if (!filter.psychologistId) {
      throw AppError.badRequest("Indica el psicólogo del que quieres ver los bloqueos");
    }
    where.psicologo_id = filter.psychologistId;
  }

  const rows = await prisma.bloqueos_agenda.findMany({
    where,
    orderBy: { fecha_inicio: "asc" },
    select: blockSelect,
  });

  return rows.map(toAgendaBlock);
}

export async function deleteAgendaBlock(auth: AuthenticatedUser, id: string): Promise<void> {
  if (auth.role !== UserRole.PSYCHOLOGIST) {
    throw AppError.forbidden("Solo el psicólogo puede eliminar sus bloqueos");
  }

  const psychologistId = await requirePsychologistIdByUser(auth.id);
  const row = await prisma.bloqueos_agenda.findUnique({
    where: { id },
    select: { psicologo_id: true },
  });

  if (!row) {
    throw AppError.notFound("El bloqueo no existe");
  }

  if (row.psicologo_id !== psychologistId) {
    throw AppError.forbidden("No puedes eliminar un bloqueo de otro profesional");
  }

  await prisma.bloqueos_agenda.delete({ where: { id } });
}

/**
 * El EXCLUDE de Postgres es la red que atrapa dos bloqueos creados a la vez.
 * La comprobación previa de la aplicación no cubre esa carrera; esta traduce el
 * 23P01 a un 409 legible.
 */
function normalizeAgendaBlockError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("excl_bloqueos_sin_empalme")) {
    throw AppError.conflict("Ya tienes un bloqueo que se solapa con ese horario");
  }

  throw error;
}
