import { randomUUID } from "node:crypto";
import type { PsychologistSchedule, PsychologistScheduleSlot } from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/app-error";

/** Horarios precargados por defecto: lunes a viernes, 09:00 a 19:00. */
const DEFAULT_SLOTS: { dayOfWeek: number; startHour: number; endHour: number }[] = [
  { dayOfWeek: 1, startHour: 9, endHour: 19 },
  { dayOfWeek: 2, startHour: 9, endHour: 19 },
  { dayOfWeek: 3, startHour: 9, endHour: 19 },
  { dayOfWeek: 4, startHour: 9, endHour: 19 },
  { dayOfWeek: 5, startHour: 9, endHour: 19 },
];

const hourToTime = (h: number): string => `${String(h).padStart(2, "0")}:00`;

async function seedDefaultSchedule(psychologistId: string): Promise<void> {
  const rows = DEFAULT_SLOTS.flatMap(({ dayOfWeek, startHour, endHour }) => {
    const out: { id: string; psicologo_id: string; dia_semana: number; hora_inicio: Date; hora_fin: Date }[] = [];
    for (let h = startHour; h < endHour; h++) {
      out.push({
        id: randomUUID(),
        psicologo_id: psychologistId,
        dia_semana: dayOfWeek,
        hora_inicio: new Date(`1970-01-01T${hourToTime(h)}:00Z`),
        hora_fin: new Date(`1970-01-01T${hourToTime(h + 1)}:00Z`),
      });
    }
    return out;
  });

  await prisma.horarios_psicologo.createMany({ data: rows, skipDuplicates: true });
}

/**
 * Devuelve la disponibilidad semanal leyendo de la BD. Si no hay filas
 * (psicologo nuevo), inserta los horarios precargados y los devuelve.
 */
export async function getPsychologistSchedule(psychologistId: string): Promise<PsychologistSchedule> {
  const psychologist = await prisma.psicologos.findUnique({
    where: { id: psychologistId },
    select: { id: true },
  });

  if (!psychologist) {
    throw AppError.notFound("El psicologo no existe");
  }

  const where = { psicologo_id: psychologistId, activo: true };
  const orderBy: Prisma.horarios_psicologoOrderByWithRelationInput[] = [
    { dia_semana: "asc" },
    { hora_inicio: "asc" },
  ];

  let rows = await prisma.horarios_psicologo.findMany({ where, orderBy });

  let seeded = false;
  if (rows.length === 0) {
    await seedDefaultSchedule(psychologistId);
    rows = await prisma.horarios_psicologo.findMany({ where, orderBy });
    seeded = true;
  }

  const slots: PsychologistScheduleSlot[] = rows.map((row) => ({
    dayOfWeek: row.dia_semana,
    startTime: row.hora_inicio.toISOString().substring(11, 16),
    endTime: row.hora_fin.toISOString().substring(11, 16),
  }));

  return { psychologistId, slots, seeded };
}
