import { randomUUID } from "node:crypto";
import { UserRole, type LegalGuardian, type TutoredPatient } from "@psicoagenda/shared";
import { Prisma } from "@/generated/prisma/client";
import {
  canal_notificacion,
  estado_consentimiento,
  tipo_notificacion,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";

/**
 * Tutoría (tickets 2026-10-28-tutoria-con-identidad-y-co-tutela y
 * 2026-10-28-mayoria-de-edad-y-fin-de-tutela).
 *
 * Un tutor es un usuario con rol PACIENTE que opera sobre la agenda de otro: el rol
 * ya no alcanza para decidir, así que todo pasa por `assertCanActOnPatient`.
 *
 * La edad se comprueba AQUÍ, en cada petición, y no solo en el barrido diario: si el
 * cron se cae, un paciente que cumplió 18 no debe seguir gestionado por su tutor
 * aunque la fila del vínculo todavía exista. El barrido solo materializa y avisa.
 */

/** Menor mientras no haya cumplido 18 (cálculo por calendario: la fecha es `DATE`). */
export function isMinorOn(birthDate: Date | null, today = new Date()): boolean {
  if (!birthDate) return false;
  const eighteenth = new Date(birthDate);
  eighteenth.setUTCFullYear(birthDate.getUTCFullYear() + 18);
  return eighteenth > today;
}

/**
 * ¿Puede la sesión operar sobre la agenda de este paciente? Él mismo, un tutor
 * vinculado (mientras el paciente sea menor), su psicólogo tratante o administración.
 * Una sola consulta trae todo lo necesario.
 */
export async function assertCanActOnPatient(auth: AuthenticatedUser, patientId: string): Promise<void> {
  if (auth.role === UserRole.ADMIN) return;

  const patient = await prisma.pacientes.findUnique({
    where: { id: patientId },
    select: {
      usuario_id: true,
      fecha_nacimiento: true,
      psicologos: { select: { usuario_id: true } },
      pacientes_tutores: { where: { tutores: { usuario_id: auth.id } }, select: { tutor_id: true } },
    },
  });
  if (!patient) throw AppError.notFound("El paciente no existe");

  if (auth.role === UserRole.PSYCHOLOGIST) {
    if (patient.psicologos?.usuario_id === auth.id) return;
    throw AppError.forbidden("No atiendes a este paciente");
  }

  if (patient.usuario_id === auth.id) return;
  if (patient.pacientes_tutores.length > 0 && isMinorOn(patient.fecha_nacimiento)) return;
  throw AppError.forbidden("No puedes gestionar la agenda de este paciente");
}

/** Pacientes cuya agenda ve una cuenta PACIENTE: el propio y los menores que tutela. */
export async function patientIdsForUser(auth: AuthenticatedUser): Promise<string[]> {
  const [own, tutored] = await Promise.all([
    prisma.pacientes.findUnique({ where: { usuario_id: auth.id }, select: { id: true } }),
    listTutoredPatients(auth),
  ]);
  return [...(own ? [own.id] : []), ...tutored.map((p) => p.id)];
}

export async function listTutoredPatients(auth: AuthenticatedUser): Promise<TutoredPatient[]> {
  const links = await prisma.pacientes_tutores.findMany({
    where: { tutores: { usuario_id: auth.id } },
    select: {
      pacientes: { select: { id: true, fecha_nacimiento: true, usuarios: { select: { nombre_completo: true } } } },
    },
  });
  return links
    .filter((link) => isMinorOn(link.pacientes.fecha_nacimiento))
    .map((link) => ({ id: link.pacientes.id, name: link.pacientes.usuarios.nombre_completo }));
}

// ---------------------------------------------------------------------------
// Gestión de tutores desde el expediente
// ---------------------------------------------------------------------------

export const linkSelect = {
  es_principal: true,
  creado_en: true,
  tutores: {
    select: {
      id: true,
      nombre_completo: true,
      telefono: true,
      parentesco: true,
      creado_en: true,
      usuarios: { select: { correo: true } },
    },
  },
} as const;

type LinkRow = Prisma.pacientes_tutoresGetPayload<{ select: typeof linkSelect }>;

export const toGuardian = (link: LinkRow): LegalGuardian => ({
  id: link.tutores.id,
  name: link.tutores.nombre_completo,
  phone: link.tutores.telefono ?? undefined,
  relationship: link.tutores.parentesco ?? undefined,
  email: link.tutores.usuarios?.correo,
  hasAccount: Boolean(link.tutores.usuarios),
  isPrimary: link.es_principal,
  createdAt: link.tutores.creado_en,
});

export async function listGuardians(patientId: string): Promise<LegalGuardian[]> {
  const links = await prisma.pacientes_tutores.findMany({
    where: { paciente_id: patientId },
    select: linkSelect,
    orderBy: [{ es_principal: "desc" }, { creado_en: "asc" }],
  });
  return links.map(toGuardian);
}

export interface AddGuardianInput {
  email?: string;
  name?: string;
  phone?: string;
  relationship?: string;
  isPrimary?: boolean;
}

export async function addGuardian(
  auth: AuthenticatedUser,
  patientId: string,
  input: AddGuardianInput,
): Promise<LegalGuardian[]> {
  await assertCanActOnPatient(auth, patientId);

  const patient = await prisma.pacientes.findUniqueOrThrow({
    where: { id: patientId },
    select: { usuario_id: true, fecha_nacimiento: true, psicologos: { select: { usuario_id: true } } },
  });
  if (!patient.fecha_nacimiento) {
    throw AppError.badRequest("Registra la fecha de nacimiento del paciente antes de vincular un tutor.");
  }
  if (!isMinorOn(patient.fecha_nacimiento)) {
    throw AppError.badRequest("Solo los pacientes menores de edad tienen tutor.");
  }

  await prisma.$transaction(async (tx) => {
    let tutorId: string;

    if (input.email) {
      const user = await tx.usuarios.findUnique({
        where: { correo: input.email.trim().toLowerCase() },
        select: { id: true, nombre_completo: true, telefono: true },
      });
      if (!user) throw AppError.notFound("No hay ninguna cuenta con ese correo.");
      if (user.id === patient.usuario_id) throw AppError.badRequest("Un paciente no puede ser su propio tutor.");
      if (user.id === patient.psicologos?.usuario_id) {
        throw AppError.badRequest("El psicólogo tratante no puede ser tutor de su paciente.");
      }

      // La persona existe una sola vez aunque tutele a varios menores.
      const tutor = await tx.tutores.upsert({
        where: { usuario_id: user.id },
        create: {
          id: randomUUID(),
          usuario_id: user.id,
          nombre_completo: user.nombre_completo,
          telefono: input.phone?.trim() || user.telefono,
          parentesco: input.relationship?.trim() || null,
        },
        update: {},
        select: { id: true },
      });
      tutorId = tutor.id;
    } else {
      const tutor = await tx.tutores.create({
        data: {
          id: randomUUID(),
          nombre_completo: input.name!.trim(),
          telefono: input.phone?.trim() || null,
          parentesco: input.relationship?.trim() || null,
        },
        select: { id: true },
      });
      tutorId = tutor.id;
    }

    const existing = await tx.pacientes_tutores.findMany({
      where: { paciente_id: patientId },
      select: { tutor_id: true },
    });
    if (existing.some((link) => link.tutor_id === tutorId)) {
      throw AppError.conflict("Esa persona ya es tutora de este paciente.");
    }

    // El primero es principal por fuerza; después, solo si se pide.
    const principal = existing.length === 0 || Boolean(input.isPrimary);
    if (principal) {
      await tx.pacientes_tutores.updateMany({ where: { paciente_id: patientId }, data: { es_principal: false } });
    }
    await tx.pacientes_tutores.create({
      data: { paciente_id: patientId, tutor_id: tutorId, es_principal: principal },
    });
  });

  return listGuardians(patientId);
}

export async function setPrimaryGuardian(
  auth: AuthenticatedUser,
  patientId: string,
  tutorId: string,
): Promise<LegalGuardian[]> {
  await assertCanActOnPatient(auth, patientId);

  await prisma.$transaction(async (tx) => {
    const link = await tx.pacientes_tutores.findUnique({
      where: { paciente_id_tutor_id: { paciente_id: patientId, tutor_id: tutorId } },
    });
    if (!link) throw AppError.notFound("Esa persona no es tutora de este paciente.");
    // Primero se apaga el actual: el índice parcial no admite dos principales ni un instante.
    await tx.pacientes_tutores.updateMany({ where: { paciente_id: patientId }, data: { es_principal: false } });
    await tx.pacientes_tutores.update({
      where: { paciente_id_tutor_id: { paciente_id: patientId, tutor_id: tutorId } },
      data: { es_principal: true },
    });
  });

  return listGuardians(patientId);
}

/**
 * Desvincular. Si se quita al principal hay que decir qué pasa después: nombrar a
 * otro (`nuevoPrincipalId`) o aceptar explícitamente quedarse sin principal.
 */
export async function removeGuardian(
  auth: AuthenticatedUser,
  patientId: string,
  tutorId: string,
  options: { nuevoPrincipalId?: string; sinPrincipal?: boolean },
): Promise<LegalGuardian[]> {
  await assertCanActOnPatient(auth, patientId);

  await prisma.$transaction(async (tx) => {
    const links = await tx.pacientes_tutores.findMany({ where: { paciente_id: patientId } });
    const target = links.find((link) => link.tutor_id === tutorId);
    if (!target) throw AppError.notFound("Esa persona no es tutora de este paciente.");

    const others = links.filter((link) => link.tutor_id !== tutorId);
    if (target.es_principal && !options.sinPrincipal) {
      if (!options.nuevoPrincipalId) {
        throw AppError.conflict(
          others.length > 0
            ? "Designa otro tutor principal antes de quitar al actual."
            : "Es el único tutor: confirma que el paciente se queda sin tutor principal.",
        );
      }
      if (!others.some((link) => link.tutor_id === options.nuevoPrincipalId)) {
        throw AppError.badRequest("El nuevo principal debe ser otro tutor del paciente.");
      }
    }

    await tx.pacientes_tutores.delete({
      where: { paciente_id_tutor_id: { paciente_id: patientId, tutor_id: tutorId } },
    });
    if (target.es_principal && options.nuevoPrincipalId && !options.sinPrincipal) {
      await tx.pacientes_tutores.update({
        where: { paciente_id_tutor_id: { paciente_id: patientId, tutor_id: options.nuevoPrincipalId } },
        data: { es_principal: true },
      });
    }
  });

  return listGuardians(patientId);
}

// ---------------------------------------------------------------------------
// Fin de tutela al cumplir 18 (barrido diario, idempotente)
// ---------------------------------------------------------------------------

/**
 * Pacientes con vínculos que ya cumplieron 18: se borran TODOS sus vínculos, los
 * consentimientos firmados por un tutor pasan a VENCIDO (no se borran: siguen
 * nombrando a quien firmó), se audita y se avisa al paciente y a los tutores con
 * cuenta. Correr dos veces no hace nada la segunda: ya no quedan vínculos.
 */
export async function finalizarTutelasVencidas(hoy = new Date()): Promise<number> {
  const limite = new Date(Date.UTC(hoy.getUTCFullYear() - 18, hoy.getUTCMonth(), hoy.getUTCDate()));

  const pacientes = await prisma.pacientes.findMany({
    where: { fecha_nacimiento: { lte: limite }, pacientes_tutores: { some: {} } },
    select: {
      id: true,
      usuarios: { select: { id: true, nombre_completo: true, notificar_correo: true } },
      pacientes_tutores: {
        select: {
          tutor_id: true,
          tutores: { select: { usuarios: { select: { id: true, notificar_correo: true } } } },
        },
      },
    },
  });

  for (const paciente of pacientes) {
    const tutores = paciente.pacientes_tutores.map((link) => link.tutores.usuarios).filter((u) => u !== null);
    const nombre = paciente.usuarios.nombre_completo;

    const avisos: Prisma.notificacionesCreateManyInput[] = [
      ...filasDeAviso(paciente.usuarios, "Tu tutoría terminó",
        "Cumpliste 18 años: desde hoy gestionas tu propia agenda. Tu psicóloga te pedirá firmar de nuevo el consentimiento informado."),
      ...tutores.flatMap((tutor) =>
        filasDeAviso(tutor, `Terminó la tutoría de ${nombre}`,
          `${nombre} cumplió 18 años: ya gestiona su propia agenda y dejaste de recibir sus avisos.`),
      ),
    ];

    await prisma.$transaction([
      prisma.pacientes_tutores.deleteMany({ where: { paciente_id: paciente.id } }),
      prisma.consentimientos_informados.updateMany({
        where: { paciente_id: paciente.id, tutor_legal_id: { not: null }, estado: estado_consentimiento.FIRMADO },
        data: { estado: estado_consentimiento.VENCIDO },
      }),
      prisma.registros_auditoria.create({
        data: {
          id: randomUUID(),
          accion: "TUTELA_FINALIZADA",
          entidad: "pacientes",
          entidad_id: paciente.id,
          detalle: { motivo: "mayoria_de_edad", tutores: paciente.pacientes_tutores.map((l) => l.tutor_id) },
        },
      }),
      prisma.notificaciones.createMany({ data: avisos }),
    ]);
  }

  return pacientes.length;
}

/** En la app siempre; por correo solo si la persona lo tiene activo. */
function filasDeAviso(
  usuario: { id: string; notificar_correo: boolean },
  asunto: string,
  mensaje: string,
): Prisma.notificacionesCreateManyInput[] {
  const canales = [canal_notificacion.SISTEMA, ...(usuario.notificar_correo ? [canal_notificacion.CORREO] : [])];
  return canales.map((canal) => ({
    id: randomUUID(),
    usuario_id: usuario.id,
    tipo: tipo_notificacion.CAMBIO,
    canal,
    asunto,
    mensaje,
    programada_para: new Date(),
  }));
}

/** Para el perfil: cuándo terminó la tutela, si ya ocurrió. */
export async function guardianshipEndedAt(patientId: string): Promise<Date | undefined> {
  const fila = await prisma.registros_auditoria.findFirst({
    where: { accion: "TUTELA_FINALIZADA", entidad: "pacientes", entidad_id: patientId },
    orderBy: { creado_en: "desc" },
    select: { creado_en: true },
  });
  return fila?.creado_en;
}

