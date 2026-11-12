import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/utils/app-error";

/**
 * Comprueba que el psicólogo no tenga un bloqueo que se cruce con el rango
 * `[start, end)`. Se ejecuta dentro de la misma transacción que la escritura de
 * la cita o solicitud, igual que `assertNoOverlap`.
 *
 * Vive en un módulo propio (sin importar los servicios de citas) para que tanto
 * `appointment.service` como `appointment-request.service` puedan usarlo sin
 * crear un ciclo de imports.
 */
export async function assertNoAgendaBlock(
  tx: Prisma.TransactionClient,
  params: { psychologistId: string; start: Date; end: Date },
): Promise<void> {
  const block = await tx.bloqueos_agenda.findFirst({
    where: {
      psicologo_id: params.psychologistId,
      // Intervalos semiabiertos: un bloqueo 10:00–11:00 no choca con una cita
      // que empieza a las 11:00.
      fecha_inicio: { lt: params.end },
      fecha_fin: { gt: params.start },
    },
    select: { id: true, motivo: true, todo_el_dia: true },
  });

  if (!block) return;

  throw new AppError(
    409,
    block.motivo
      ? `La agenda está bloqueada: ${block.motivo}`
      : "El profesional no tiene disponible ese horario",
    "AGENDA_BLOQUEADA",
    {
      blockId: block.id,
      allDay: block.todo_el_dia,
      reason: block.motivo ?? undefined,
    },
  );
}
