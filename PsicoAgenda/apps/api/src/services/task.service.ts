import { randomUUID } from "node:crypto";
import type { PatientTask, SessionTask } from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { canal_notificacion, tipo_notificacion } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { assertCanActOnPatient, isMinorOn, patientIdsForUser } from "@/services/guardianship.service";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";

export interface TaskInput {
  id?: string;
  text: string;
}

type TaskRow = { id: string; texto: string; hecha_en: Date | null };

export const toSessionTask = (row: TaskRow): SessionTask => ({
  id: row.id,
  text: row.texto,
  doneAt: row.hecha_en ?? undefined,
});

/**
 * Deja las tareas de la hoja como vienen: borra las que ya no están, corrige el
 * texto de las que siguen (sin tocar si ya se hicieron) y crea las nuevas.
 * Devuelve los textos nuevos, que son los que se avisan al paciente.
 */
export async function syncTasks(
  tx: Prisma.TransactionClient,
  entryId: string,
  patientId: string,
  tasks: TaskInput[],
): Promise<string[]> {
  const limpias = tasks.map((t) => ({ ...t, text: t.text.trim() })).filter((t) => t.text !== "");
  const existentes = await tx.tareas_sesion.findMany({
    where: { entrada_id: entryId },
    select: { id: true, texto: true, orden: true },
  });
  const vigentes = new Map(existentes.map((t) => [t.id, t]));
  const conservadas = new Set(limpias.flatMap((t) => (t.id && vigentes.has(t.id) ? [t.id] : [])));

  await tx.tareas_sesion.deleteMany({ where: { entrada_id: entryId, id: { notIn: [...conservadas] } } });

  // Las nuevas van en una sola inserción; de las conservadas solo se escribe la que cambió.
  const porCrear: Prisma.tareas_sesionCreateManyInput[] = [];
  for (const [orden, tarea] of limpias.entries()) {
    const previa = tarea.id ? vigentes.get(tarea.id) : undefined;
    if (!previa) {
      porCrear.push({ id: randomUUID(), entrada_id: entryId, paciente_id: patientId, texto: tarea.text, orden });
    } else if (previa.texto !== tarea.text || previa.orden !== orden) {
      await tx.tareas_sesion.update({ where: { id: previa.id }, data: { texto: tarea.text, orden } });
    }
  }
  if (porCrear.length > 0) await tx.tareas_sesion.createMany({ data: porCrear });
  return porCrear.map((tarea) => tarea.texto);
}

/**
 * Avisa de tareas nuevas: en la app siempre y por correo si la persona lo tiene
 * activo. Si el paciente es menor, el aviso va a sus tutores con cuenta.
 */
export async function avisarTareas(patientId: string, textos: string[]): Promise<void> {
  if (textos.length === 0) return;

  const paciente = await prisma.pacientes.findUnique({
    where: { id: patientId },
    select: {
      fecha_nacimiento: true,
      usuarios: { select: { id: true, correo: true, nombre_completo: true, notificar_correo: true } },
      pacientes_tutores: {
        select: { tutores: { select: { usuarios: { select: { id: true, notificar_correo: true } } } } },
      },
    },
  });
  if (!paciente) return;

  const menor = isMinorOn(paciente.fecha_nacimiento);
  const tutores = menor
    ? paciente.pacientes_tutores.flatMap((link) => (link.tutores.usuarios ? [link.tutores.usuarios] : []))
    : [];
  // Un menor registrado por su tutor no tiene cuenta: su correo reservado no recibe nada.
  const propio = paciente.usuarios.correo.endsWith("@sin-cuenta.invalid") ? [] : [paciente.usuarios];
  const destinatarios = [...propio, ...tutores];

  const asunto = textos.length === 1 ? "Tienes una tarea nueva" : `Tienes ${textos.length} tareas nuevas`;
  const lista = textos.map((texto) => `• ${texto}`).join("\n");
  const paraQuien = (usuarioId: string) =>
    usuarioId === paciente.usuarios.id ? "" : ` para ${paciente.usuarios.nombre_completo}`;

  await prisma.notificaciones.createMany({
    data: destinatarios.flatMap((usuario) =>
      [canal_notificacion.SISTEMA, ...(usuario.notificar_correo ? [canal_notificacion.CORREO] : [])].map((canal) => ({
        id: randomUUID(),
        usuario_id: usuario.id,
        tipo: tipo_notificacion.TAREA,
        canal,
        asunto,
        mensaje: `Tu psicóloga dejó tarea${paraQuien(usuario.id)} en la última sesión:\n${lista}`,
        programada_para: new Date(),
      })),
    ),
  });
}

/** Tareas de la cuenta y de los menores que tutela: las pendientes y las hechas en los últimos 14 días. */
export async function listMyTasks(auth: AuthenticatedUser): Promise<PatientTask[]> {
  const patientIds = await patientIdsForUser(auth);
  if (patientIds.length === 0) return [];

  const hace14 = new Date(Date.now() - 14 * 24 * 60 * 60_000);
  const rows = await prisma.tareas_sesion.findMany({
    where: { paciente_id: { in: patientIds }, OR: [{ hecha_en: null }, { hecha_en: { gte: hace14 } }] },
    select: {
      id: true,
      texto: true,
      hecha_en: true,
      paciente_id: true,
      pacientes: { select: { usuario_id: true, usuarios: { select: { nombre_completo: true } } } },
      entradas_bitacora: { select: { fecha_sesion: true } },
    },
    orderBy: [{ entradas_bitacora: { fecha_sesion: "desc" } }, { orden: "asc" }],
  });

  return rows.map((row) => ({
    ...toSessionTask(row),
    patientId: row.paciente_id,
    // Solo se rotula cuando la tarea es de un menor a cargo, no de la propia cuenta.
    patientName: row.pacientes.usuario_id === auth.id ? undefined : row.pacientes.usuarios.nombre_completo,
    sessionDate: row.entradas_bitacora.fecha_sesion,
  }));
}

export async function setTaskDone(auth: AuthenticatedUser, id: string, done: boolean): Promise<SessionTask> {
  const tarea = await prisma.tareas_sesion.findUnique({ where: { id }, select: { paciente_id: true } });
  if (!tarea) throw AppError.notFound("La tarea no existe");
  await assertCanActOnPatient(auth, tarea.paciente_id);

  const updated = await prisma.tareas_sesion.update({
    where: { id },
    data: { hecha_en: done ? new Date() : null },
    select: { id: true, texto: true, hecha_en: true },
  });
  return toSessionTask(updated);
}
