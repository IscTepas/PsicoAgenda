import { randomUUID } from "node:crypto";
import {
  AppointmentModality as SharedModality,
  type NoteKind,
  type SessionLogEntry,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import {
  estado_consentimiento,
  estado_expediente,
  estado_nota,
  modalidad_cita,
  tipo_nota,
} from "@/generated/prisma/enums";
import { auditar, type ContextoAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { camposDeNota, sellar } from "@/lib/sello";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";
import {
  confirmarContrasena,
  ensureClinicalRecordId,
  fechaDeConservacion,
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

const KIND_DE_TIPO: Record<tipo_nota, NoteKind> = {
  [tipo_nota.EVOLUCION]: "evolution",
  [tipo_nota.ACLARATORIA]: "clarification",
  [tipo_nota.INTERCONSULTA]: "referral",
  [tipo_nota.EGRESO]: "discharge",
};
const TIPO_DE_KIND: Record<"evolution" | "referral" | "discharge", tipo_nota> = {
  evolution: tipo_nota.EVOLUCION,
  referral: tipo_nota.INTERCONSULTA,
  discharge: tipo_nota.EGRESO,
};

/**
 * La interfaz numera las sesiones cronológicamente. El orden es
 * `(sessionDate, createdAt)`, igual que el que usa la consulta. Solo las notas
 * de evolución son sesiones: aclaratorias, interconsultas y egresos no cuentan.
 */
function withSessionNumber(rows: LogEntryRow[]): SessionLogEntry[] {
  const ordered = [...rows]
    .filter((row) => row.tipo === tipo_nota.EVOLUCION)
    .sort((a, b) => {
      const byDate = a.fecha_sesion.getTime() - b.fecha_sesion.getTime();
      if (byDate !== 0) return byDate;
      return a.creado_en.getTime() - b.creado_en.getTime();
    });

  const numberById = new Map(ordered.map((row, index) => [row.id, index + 1]));

  return rows
    .map((row) => ({
      id: row.id,
      patientId: row.expedientes_clinicos.paciente_id,
      appointmentId: row.cita_id ?? undefined,
      sessionNumber: numberById.get(row.id) ?? 0,
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
      kind: KIND_DE_TIPO[row.tipo],
      status: row.estado === estado_nota.CERRADA ? ("closed" as const) : ("draft" as const),
      closedAt: row.cerrada_en ?? undefined,
      closedByName: row.cerrada_en ? row.psicologos.usuarios.nombre_completo : undefined,
      closedByLicense: row.cerrada_en ? row.psicologos.cedula_profesional : undefined,
      hash: row.hash ?? undefined,
      parentId: row.nota_padre_id ?? undefined,
      referredTo: row.referido_a ?? undefined,
      referralReason: row.motivo_referencia ?? undefined,
      dischargeReason: row.motivo_egreso ?? undefined,
      dischargeSummary: row.resumen_egreso ?? undefined,
      createdAt: row.creado_en,
      updatedAt: row.actualizado_en,
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

const notasDelExpediente = async (expedienteId: string) =>
  withSessionNumber(
    await prisma.entradas_bitacora.findMany({ where: { expediente_id: expedienteId }, include: logInclude }),
  );

export async function listLogEntries(
  auth: AuthenticatedUser,
  patientId: string,
  ctx?: ContextoAuditoria,
): Promise<SessionLogEntry[]> {
  await requirePatientAccess(auth, patientId);

  const record = await prisma.expedientes_clinicos.findUnique({
    where: { paciente_id: patientId },
    select: { id: true },
  });

  if (!record) return [];
  await auditar(ctx, "VER_NOTAS", "expediente", patientId);
  return notasDelExpediente(record.id);
}

export interface CreateLogEntryInput {
  kind?: "evolution" | "referral" | "discharge";
  appointmentId?: string;
  sessionType?: string;
  notes: string;
  interventions?: string;
  homework?: string;
  tasks?: TaskInput[];
  referredTo?: string;
  referralReason?: string;
  dischargeReason?: string;
  dischargeSummary?: string;
}

const emptyToNull = (value: string | undefined): string | null =>
  value === undefined || value.trim() === "" ? null : value;

/**
 * Regla de flujo (NOM-004): no hay notas de evolución sin consentimiento
 * informado vigente y sin la historia clínica cerrada.
 */
export async function requisitosParaEvolucion(patientId: string): Promise<string | null> {
  const [consentimiento, expediente] = await Promise.all([
    prisma.consentimientos_informados.findFirst({
      where: { paciente_id: patientId, estado: estado_consentimiento.FIRMADO },
      select: { id: true },
    }),
    prisma.expedientes_clinicos.findUnique({
      where: { paciente_id: patientId },
      select: { historia_estado: true },
    }),
  ]);
  const faltan = [
    !consentimiento && "el consentimiento informado firmado",
    expediente?.historia_estado !== estado_nota.CERRADA && "la historia clínica cerrada",
  ].filter(Boolean);
  return faltan.length > 0 ? `Antes de escribir notas de evolución falta ${faltan.join(" y ")}.` : null;
}

export async function createLogEntry(
  auth: AuthenticatedUser,
  patientId: string,
  input: CreateLogEntryInput,
  ctx?: ContextoAuditoria,
): Promise<SessionLogEntry> {
  await requirePatientAccess(auth, patientId);
  const psychologistId = await requirePsychologistId(auth);
  const tipo = TIPO_DE_KIND[input.kind ?? "evolution"];

  if (tipo === tipo_nota.EVOLUCION) {
    const falta = await requisitosParaEvolucion(patientId);
    if (falta) throw new AppError(409, falta, "FALTAN_REQUISITOS");
  }
  if (tipo === tipo_nota.INTERCONSULTA && !input.referredTo?.trim()) {
    throw AppError.badRequest("Escribe a quién se refiere al paciente.");
  }
  if (tipo === tipo_nota.EGRESO && !input.dischargeReason?.trim()) {
    throw AppError.badRequest("Escribe el motivo del egreso.");
  }

  const clinicalRecordId = await ensureClinicalRecordId(patientId);

  // La fecha de la sesión es la de la cita asociada; sin cita, el momento actual del servidor.
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
      where: { cita_id: input.appointmentId, tipo: tipo_nota.EVOLUCION },
      select: { id: true },
    });
    if (previa && tipo === tipo_nota.EVOLUCION) throw AppError.conflict("Esa sesión ya tiene su hoja de bitácora");
  }

  const entryId = randomUUID();
  let tareasNuevas: string[] = [];
  await prisma.$transaction(async (tx) => {
    await tx.entradas_bitacora.create({
      data: {
        id: entryId,
        expediente_id: clinicalRecordId,
        cita_id: input.appointmentId ?? null,
        psicologo_id: psychologistId,
        tipo,
        fecha_sesion: sessionDate,
        notas_sesion: input.notes,
        objetivos_trabajados: emptyToNull(input.interventions),
        plan_proxima_sesion: emptyToNull(input.homework),
        estado_general: emptyToNull(input.sessionType),
        referido_a: emptyToNull(input.referredTo),
        motivo_referencia: emptyToNull(input.referralReason),
        motivo_egreso: emptyToNull(input.dischargeReason),
        resumen_egreso: emptyToNull(input.dischargeSummary),
      },
    });
    tareasNuevas = await syncTasks(tx, entryId, patientId, input.tasks ?? []);
    await auditar(ctx, "CREAR_NOTA", "expediente", patientId, { notaId: entryId, tipo }, tx);
  });
  await avisarTareas(patientId, tareasNuevas);

  return (await notasDelExpediente(clinicalRecordId)).find((entry) => entry.id === entryId)!;
}

export interface UpdateLogEntryInput {
  appointmentId?: string;
  sessionType?: string;
  notes?: string;
  interventions?: string;
  homework?: string;
  tasks?: TaskInput[];
  referredTo?: string;
  referralReason?: string;
  dischargeReason?: string;
  dischargeSummary?: string;
}

/**
 * Solo se edita un borrador. Antes de cambiarlo se guarda la versión anterior en
 * `revisiones_bitacora`: nada de lo escrito se pierde.
 */
export async function updateLogEntry(
  auth: AuthenticatedUser,
  id: string,
  input: UpdateLogEntryInput,
  ctx?: ContextoAuditoria,
): Promise<SessionLogEntry> {
  const existing = await prisma.entradas_bitacora.findUnique({
    where: { id },
    include: logInclude,
  });

  if (!existing) {
    throw AppError.notFound("La nota de bitácora no existe");
  }

  await requirePatientAccess(auth, existing.expedientes_clinicos.paciente_id);
  if (existing.estado === estado_nota.CERRADA) {
    throw AppError.conflict("La nota está cerrada: ya no se modifica. Agrega una nota aclaratoria.");
  }

  const patientId = existing.expedientes_clinicos.paciente_id;
  let tareasNuevas: string[] = [];
  await prisma.$transaction(async (tx) => {
    await tx.revisiones_bitacora.create({
      data: {
        id: randomUUID(),
        entrada_id: id,
        version: existing.version,
        notas_sesion: existing.notas_sesion,
        objetivos_trabajados: existing.objetivos_trabajados,
        plan_proxima_sesion: existing.plan_proxima_sesion,
        modificado_por_id: auth.id,
      },
    });
    await tx.entradas_bitacora.update({
      where: { id },
      data: {
        cita_id: input.appointmentId ?? undefined,
        notas_sesion: input.notes,
        objetivos_trabajados: input.interventions !== undefined ? emptyToNull(input.interventions) : undefined,
        plan_proxima_sesion: input.homework !== undefined ? emptyToNull(input.homework) : undefined,
        estado_general: input.sessionType !== undefined ? emptyToNull(input.sessionType) : undefined,
        referido_a: input.referredTo !== undefined ? emptyToNull(input.referredTo) : undefined,
        motivo_referencia: input.referralReason !== undefined ? emptyToNull(input.referralReason) : undefined,
        motivo_egreso: input.dischargeReason !== undefined ? emptyToNull(input.dischargeReason) : undefined,
        resumen_egreso: input.dischargeSummary !== undefined ? emptyToNull(input.dischargeSummary) : undefined,
        version: { increment: 1 },
      },
    });
    if (input.tasks) tareasNuevas = await syncTasks(tx, id, patientId, input.tasks);
    await auditar(ctx, "EDITAR_NOTA", "expediente", patientId, { notaId: id }, tx);
  });
  await avisarTareas(patientId, tareasNuevas);

  return (await notasDelExpediente(existing.expediente_id)).find((entry) => entry.id === id)!;
}

/**
 * Cierra (sella) una nota: pide la contraseña y guarda el SHA-256 del contenido,
 * la cédula, el paciente y la hora del servidor. Desde ahí la base rechaza
 * cualquier cambio (`trg_nota_cerrada_inmutable`). Cerrar la nota de egreso da de
 * alta el expediente y fija su conservación a 5 años.
 */
export async function cerrarNota(
  auth: AuthenticatedUser,
  id: string,
  password: string,
  ctx?: ContextoAuditoria,
): Promise<SessionLogEntry> {
  const nota = await prisma.entradas_bitacora.findUnique({ where: { id }, include: logInclude });
  if (!nota) throw AppError.notFound("La nota de bitácora no existe");
  const patientId = nota.expedientes_clinicos.paciente_id;
  await requirePatientAccess(auth, patientId);
  if (nota.estado === estado_nota.CERRADA) throw AppError.conflict("La nota ya está cerrada.");
  if (nota.psicologos.usuario_id !== auth.id) {
    throw AppError.forbidden("Solo quien escribió la nota puede cerrarla.");
  }

  await confirmarContrasena(auth, password);

  const ahora = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.entradas_bitacora.update({
      where: { id },
      data: {
        estado: estado_nota.CERRADA,
        cerrada_en: ahora,
        cerrada_por_id: auth.id,
        hash: sellar(camposDeNota(nota), nota.psicologos.cedula_profesional, patientId, ahora),
      },
    });
    if (nota.tipo === tipo_nota.EGRESO) {
      await tx.expedientes_clinicos.update({
        where: { id: nota.expediente_id },
        data: { estado: estado_expediente.INACTIVO, conservar_hasta: fechaDeConservacion(ahora) },
      });
    }
    await auditar(ctx, "CERRAR_NOTA", "expediente", patientId, { notaId: id }, tx);
  });

  return (await notasDelExpediente(nota.expediente_id)).find((entry) => entry.id === id)!;
}

/**
 * Nota aclaratoria: corrige una nota cerrada sin tocarla. Se crea ya sellada,
 * con la hora del servidor y ligada a la original por `nota_padre_id`.
 */
export async function crearAclaracion(
  auth: AuthenticatedUser,
  padreId: string,
  input: { text: string; password: string },
  ctx?: ContextoAuditoria,
): Promise<SessionLogEntry> {
  const padre = await prisma.entradas_bitacora.findUnique({ where: { id: padreId }, include: logInclude });
  if (!padre) throw AppError.notFound("La nota de bitácora no existe");
  const patientId = padre.expedientes_clinicos.paciente_id;
  await requirePatientAccess(auth, patientId);
  if (padre.estado !== estado_nota.CERRADA) {
    throw AppError.conflict("La nota todavía es borrador: corrígela directamente.");
  }
  const psicologo = await prisma.psicologos.findUnique({
    where: { usuario_id: auth.id },
    select: { id: true, cedula_profesional: true },
  });
  if (!psicologo) throw AppError.forbidden("Solo la psicóloga puede escribir notas aclaratorias.");

  await confirmarContrasena(auth, input.password);

  const id = randomUUID();
  const ahora = new Date();
  const datos = {
    tipo: tipo_nota.ACLARATORIA,
    fecha_sesion: ahora,
    notas_sesion: input.text.trim(),
    objetivos_trabajados: null,
    plan_proxima_sesion: null,
    estado_general: null,
    referido_a: null,
    motivo_referencia: null,
    motivo_egreso: null,
    resumen_egreso: null,
    nota_padre_id: padreId,
  };
  await prisma.$transaction(async (tx) => {
    await tx.entradas_bitacora.create({
      data: {
        id,
        expediente_id: padre.expediente_id,
        psicologo_id: psicologo.id,
        ...datos,
        estado: estado_nota.CERRADA,
        cerrada_en: ahora,
        cerrada_por_id: auth.id,
        hash: sellar(camposDeNota(datos), psicologo.cedula_profesional, patientId, ahora),
      },
    });
    await auditar(ctx, "NOTA_ACLARATORIA", "expediente", patientId, { notaId: id, notaPadreId: padreId }, tx);
  });

  return (await notasDelExpediente(padre.expediente_id)).find((entry) => entry.id === id)!;
}

/** Vuelve a calcular el sello de una nota cerrada y lo compara con el guardado. */
export async function verificarNota(
  auth: AuthenticatedUser,
  id: string,
): Promise<{ valid: boolean; hash?: string }> {
  const nota = await prisma.entradas_bitacora.findUnique({ where: { id }, include: logInclude });
  if (!nota) throw AppError.notFound("La nota de bitácora no existe");
  const patientId = nota.expedientes_clinicos.paciente_id;
  await requirePatientAccess(auth, patientId);
  if (nota.estado !== estado_nota.CERRADA || !nota.hash || !nota.cerrada_en) return { valid: false };
  const calculado = sellar(camposDeNota(nota), nota.psicologos.cedula_profesional, patientId, nota.cerrada_en);
  return { valid: calculado === nota.hash, hash: nota.hash };
}
