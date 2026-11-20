import { randomUUID } from "node:crypto";
import {
  APARTADOS_EXAMEN_MENTAL,
  ConsentStatus as SharedConsentStatus,
  PDF_CONSENTIMIENTO_MAX_BYTES,
  RecordStatus as SharedRecordStatus,
  UserRole,
  type AuditEntry,
  type ClinicalRecord,
  type InformedConsent,
  type MentalExam,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { estado_consentimiento, estado_expediente, estado_nota } from "@/generated/prisma/enums";
import { auditar, type ContextoAuditoria } from "@/lib/auditoria";
import { prisma } from "@/lib/prisma";
import { sellar } from "@/lib/sello";
import { enlacePdfConsentimiento, esContrasenaActual, guardarPdfConsentimiento } from "@/lib/supabase-admin";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";

/** Años que se conserva el expediente después del egreso o la baja (NOM-004 5.4). */
export const ANIOS_CONSERVACION = 5;

export const fechaDeConservacion = (desde: Date = new Date()): Date => {
  const hasta = new Date(desde);
  hasta.setFullYear(hasta.getFullYear() + ANIOS_CONSERVACION);
  return hasta;
};

const consentInclude = {
  tutores: { include: { usuarios: { select: { correo: true } } } },
} satisfies Prisma.consentimientos_informadosInclude;

type ClinicalRecordRow = Prisma.expedientes_clinicosModel;
type ConsentRow = Prisma.consentimientos_informadosGetPayload<{ include: typeof consentInclude }>;

const cargarConsentimientos = (patientId: string): Promise<ConsentRow[]> =>
  prisma.consentimientos_informados.findMany({
    where: { paciente_id: patientId },
    include: consentInclude,
    orderBy: { firmado_en: "desc" },
  });

/** Establecimiento y profesional que atiende al paciente (carátula del expediente). */
async function cargarCaratula(patientId: string): Promise<ClinicalRecord["facility"]> {
  const paciente = await prisma.pacientes.findUnique({
    where: { id: patientId },
    select: {
      psicologos: {
        select: {
          nombre_consultorio: true,
          tipo_establecimiento: true,
          domicilio_consultorio: true,
          cedula_profesional: true,
          usuarios: { select: { nombre_completo: true } },
        },
      },
    },
  });
  const p = paciente?.psicologos;
  return {
    name: p?.nombre_consultorio ?? undefined,
    type: p?.tipo_establecimiento ?? "Consultorio de psicología",
    address: p?.domicilio_consultorio ?? undefined,
    psychologistName: p?.usuarios.nombre_completo,
    licenseNumber: p?.cedula_profesional,
  };
}

const toSharedRecordStatus = (status: estado_expediente): SharedRecordStatus => {
  switch (status) {
    case estado_expediente.ACTIVO:
      return SharedRecordStatus.ACTIVE;
    case estado_expediente.INACTIVO:
      return SharedRecordStatus.INACTIVE;
  }
};

const toSharedConsentStatus = (status: estado_consentimiento): SharedConsentStatus => {
  switch (status) {
    case estado_consentimiento.FIRMADO:
      return SharedConsentStatus.SIGNED;
    case estado_consentimiento.RETIRADO:
      return SharedConsentStatus.WITHDRAWN;
    case estado_consentimiento.VENCIDO:
      return SharedConsentStatus.EXPIRED;
  }
};

/**
 * El tutor que firmó sigue apuntando a `tutores` aunque el vínculo con el menor
 * ya se haya borrado: el consentimiento conserva su firmante histórico.
 */
const toInformedConsent = (row: ConsentRow): InformedConsent => {
  const tutor = row.tutores;
  return {
    id: row.id,
    patientId: row.paciente_id,
    signedAt: row.firmado_en,
    document: row.documento,
    // La ruta del PDF no sale de la API: se abre con un enlace temporal.
    documentUrl: row.documento_url?.startsWith("http") ? row.documento_url : undefined,
    hasPdf: Boolean(row.documento_url),
    signatureImage: row.firma_imagen ?? undefined,
    privacyNoticeAccepted: row.aviso_privacidad_aceptado,
    legalGuardianId: row.tutor_legal_id ?? undefined,
    legalGuardian: tutor
      ? {
          id: tutor.id,
          name: tutor.nombre_completo,
          phone: tutor.telefono ?? undefined,
          relationship: tutor.parentesco ?? undefined,
          email: tutor.usuarios?.correo,
          hasAccount: Boolean(tutor.usuarios),
          createdAt: tutor.creado_en,
        }
      : undefined,
    status: toSharedConsentStatus(row.estado),
    withdrawnAt: row.retirado_en ?? undefined,
    createdAt: row.creado_en,
  };
};

const examenDe = (valor: Prisma.JsonValue | null): MentalExam | undefined =>
  valor && typeof valor === "object" && !Array.isArray(valor) ? valor : undefined;

const toClinicalRecord = (
  row: ClinicalRecordRow,
  consents: ConsentRow[],
  facility: ClinicalRecord["facility"],
): ClinicalRecord => ({
  id: row.id,
  patientId: row.paciente_id,
  folio: row.folio,
  openedAt: row.abierto_en,
  facility,
  chiefComplaint: row.motivo_consulta ?? undefined,
  currentProblem: row.problema_actual ?? undefined,
  familyHistory: row.antecedentes_heredofamiliares ?? undefined,
  nonPathologicalHistory: row.antecedentes_no_patologicos ?? undefined,
  pathologicalHistory: row.antecedentes_patologicos ?? undefined,
  mentalExam: examenDe(row.examen_mental),
  psychometricTests: row.pruebas_psicometricas ?? undefined,
  diagnosis: row.diagnostico ?? undefined,
  diagnosisCode: row.diagnostico_codigo ?? undefined,
  diagnosisSystem: (row.diagnostico_sistema as ClinicalRecord["diagnosisSystem"]) ?? undefined,
  prognosis: row.pronostico ?? undefined,
  treatmentPlan: row.plan_terapeutico ?? undefined,
  background: row.antecedentes ?? undefined,
  generalObservations: row.observaciones_generales ?? undefined,
  historyStatus: row.historia_estado === estado_nota.CERRADA ? "closed" : "draft",
  historyClosedAt: row.historia_cerrada_en ?? undefined,
  historyHash: row.historia_hash ?? undefined,
  retainUntil: row.conservar_hasta ?? undefined,
  status: toSharedRecordStatus(row.estado),
  consents: consents.map(toInformedConsent),
  updatedAt: row.actualizado_en,
});

/**
 * Identificador del perfil de psicólogo de la sesión. El `id` del perfil no viaja
 * en el token, así que se resuelve contra la base en cada petición.
 */
export async function requirePsychologistId(auth: AuthenticatedUser): Promise<string> {
  const psychologist = await prisma.psicologos.findUnique({
    where: { usuario_id: auth.id },
    select: { id: true },
  });

  if (!psychologist) {
    throw AppError.forbidden("La cuenta no tiene perfil de psicólogo");
  }

  return psychologist.id;
}

/**
 * Comprueba que la sesión puede operar sobre el expediente del paciente: el
 * psicólogo dueño del paciente o un administrador. El paciente no accede al
 * expediente clínico (la interfaz tampoco lo expone).
 */
export async function requirePatientAccess(
  auth: AuthenticatedUser,
  patientId: string,
): Promise<{ patientId: string; psychologistId: string | null }> {
  if (auth.role === UserRole.PATIENT) {
    throw AppError.forbidden("No tienes acceso al expediente clínico");
  }

  const patient = await prisma.pacientes.findUnique({
    where: { id: patientId },
    select: { id: true, psicologo_id: true },
  });

  if (!patient) {
    throw AppError.notFound("El paciente no existe");
  }

  if (auth.role === UserRole.PSYCHOLOGIST) {
    const psychologistId = await requirePsychologistId(auth);
    if (patient.psicologo_id !== psychologistId) {
      throw AppError.forbidden("El paciente pertenece a otro profesional");
    }
  }

  return { patientId: patient.id, psychologistId: patient.psicologo_id };
}

/** Expediente del paciente (creado de forma perezosa), sin auditar. */
async function cargarExpediente(patientId: string): Promise<ClinicalRecord> {
  const [existing, consents, facility] = await Promise.all([
    prisma.expedientes_clinicos.findUnique({ where: { paciente_id: patientId } }),
    cargarConsentimientos(patientId),
    cargarCaratula(patientId),
  ]);
  const row = existing ?? (await prisma.expedientes_clinicos.create({ data: { id: randomUUID(), paciente_id: patientId } }));
  return toClinicalRecord(row, consents, facility);
}

/**
 * Devuelve el expediente del paciente, creándolo de forma perezosa si aún no
 * existe. Cada consulta queda en la bitácora de auditoría.
 */
export async function getOrCreateClinicalRecord(
  auth: AuthenticatedUser,
  patientId: string,
  ctx?: ContextoAuditoria,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);
  const record = await cargarExpediente(patientId);
  await auditar(ctx, "VER_EXPEDIENTE", "expediente", patientId);
  return record;
}

/** Identificador del expediente, creándolo si no existe (uso interno de bitácora). */
export async function ensureClinicalRecordId(patientId: string): Promise<string> {
  const existing = await prisma.expedientes_clinicos.findUnique({
    where: { paciente_id: patientId },
    select: { id: true },
  });

  if (existing) return existing.id;

  const created = await prisma.expedientes_clinicos.create({
    data: { id: randomUUID(), paciente_id: patientId },
    select: { id: true },
  });

  return created.id;
}

/** Contraseña de la psicóloga antes de sellar algo (NOM-024: no repudio). */
export async function confirmarContrasena(auth: AuthenticatedUser, password: string): Promise<void> {
  if (!(await esContrasenaActual(auth.id, password))) {
    throw new AppError(400, "La contraseña no es correcta.", "CONTRASENA_INCORRECTA");
  }
}

export interface CreateConsentInput {
  signedAt: string; // YYYY-MM-DD
  document: string;
  guardianId?: string;
  signatureImage?: string;
  pdfBase64?: string;
  privacyNoticeAccepted: true;
}

const esMenor = (nacimiento: Date | null) => {
  if (!nacimiento) return false;
  const mayoria = new Date(nacimiento);
  mayoria.setFullYear(nacimiento.getFullYear() + 18);
  return mayoria > new Date();
};

/** Decodifica el PDF y revisa que de verdad sea un PDF (empieza con %PDF). */
function pdfDesdeBase64(base64: string): Buffer {
  const limpio = base64.replace(/^data:application\/pdf;base64,/, "");
  const pdf = Buffer.from(limpio, "base64");
  if (pdf.length === 0 || pdf.length > PDF_CONSENTIMIENTO_MAX_BYTES) {
    throw AppError.badRequest("El PDF debe pesar 5 MB o menos.");
  }
  if (pdf.subarray(0, 4).toString("latin1") !== "%PDF") {
    throw AppError.badRequest("El archivo no es un PDF.");
  }
  return pdf;
}

/**
 * Registra el consentimiento informado (NOM-004 10.1): firma en pantalla o PDF
 * firmado, y el aviso de privacidad aceptado. Un menor lo firma uno de sus
 * tutores; un adulto, él mismo. El nuevo reemplaza al vigente, que pasa a
 * VENCIDO (no se borra: queda como historial).
 */
export async function registrarConsentimiento(
  auth: AuthenticatedUser,
  patientId: string,
  input: CreateConsentInput,
  ctx?: ContextoAuditoria,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);
  if (!input.privacyNoticeAccepted) throw AppError.badRequest("Falta aceptar el aviso de privacidad.");
  if (!input.signatureImage && !input.pdfBase64) {
    throw AppError.badRequest("Firma en pantalla o sube el PDF firmado.");
  }
  const paciente = await prisma.pacientes.findUnique({
    where: { id: patientId },
    select: { fecha_nacimiento: true },
  });
  const menor = esMenor(paciente?.fecha_nacimiento ?? null);

  if (menor && !input.guardianId) {
    throw AppError.badRequest("El paciente es menor de edad: el consentimiento lo firma uno de sus tutores.");
  }
  if (!menor && input.guardianId) {
    throw AppError.badRequest("El paciente es mayor de edad: el consentimiento lo firma él mismo.");
  }
  if (input.guardianId) {
    const vinculo = await prisma.pacientes_tutores.findUnique({
      where: { paciente_id_tutor_id: { paciente_id: patientId, tutor_id: input.guardianId } },
    });
    if (!vinculo) throw AppError.badRequest("Ese tutor no está registrado para este paciente.");
  }

  const consentId = randomUUID();
  // El PDF se sube antes de escribir en la base: si falla, no queda un registro a medias.
  const rutaPdf = input.pdfBase64
    ? await guardarPdfConsentimiento(`${patientId}/${consentId}.pdf`, pdfDesdeBase64(input.pdfBase64))
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.consentimientos_informados.updateMany({
      where: { paciente_id: patientId, estado: estado_consentimiento.FIRMADO },
      data: { estado: estado_consentimiento.VENCIDO },
    });
    await tx.consentimientos_informados.create({
      data: {
        id: consentId,
        paciente_id: patientId,
        // Mediodía local para que la fecha no se corra de día por la zona horaria.
        firmado_en: new Date(`${input.signedAt}T12:00:00`),
        documento: input.document.trim(),
        documento_url: rutaPdf,
        firma_imagen: input.signatureImage ?? null,
        aviso_privacidad_aceptado: true,
        tutor_legal_id: input.guardianId ?? null,
      },
    });
    await auditar(ctx, "REGISTRAR_CONSENTIMIENTO", "expediente", patientId, { consentimientoId: consentId }, tx);
  });
  return cargarExpediente(patientId);
}

/** El paciente (o su tutor) retira el consentimiento: queda registrado cuándo. */
export async function retirarConsentimiento(
  auth: AuthenticatedUser,
  patientId: string,
  consentId: string,
  ctx?: ContextoAuditoria,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);
  const { count } = await prisma.consentimientos_informados.updateMany({
    where: { id: consentId, paciente_id: patientId, estado: estado_consentimiento.FIRMADO },
    data: { estado: estado_consentimiento.RETIRADO, retirado_en: new Date() },
  });
  if (count === 0) throw AppError.notFound("No hay un consentimiento vigente con ese identificador.");
  await auditar(ctx, "RETIRAR_CONSENTIMIENTO", "expediente", patientId, { consentimientoId: consentId });
  return cargarExpediente(patientId);
}

/** Enlace temporal al PDF firmado del consentimiento; la descarga queda auditada. */
export async function enlaceDelConsentimiento(
  auth: AuthenticatedUser,
  patientId: string,
  consentId: string,
  ctx?: ContextoAuditoria,
): Promise<string> {
  await requirePatientAccess(auth, patientId);
  const consentimiento = await prisma.consentimientos_informados.findFirst({
    where: { id: consentId, paciente_id: patientId },
    select: { documento_url: true },
  });
  if (!consentimiento?.documento_url) throw AppError.notFound("Este consentimiento no tiene PDF.");
  const url = consentimiento.documento_url.startsWith("http")
    ? consentimiento.documento_url
    : await enlacePdfConsentimiento(consentimiento.documento_url);
  await auditar(ctx, "DESCARGAR_CONSENTIMIENTO", "expediente", patientId, { consentimientoId: consentId });
  return url;
}

export interface UpdateClinicalRecordInput {
  chiefComplaint?: string;
  currentProblem?: string;
  familyHistory?: string;
  nonPathologicalHistory?: string;
  pathologicalHistory?: string;
  mentalExam?: MentalExam;
  psychometricTests?: string;
  diagnosis?: string;
  diagnosisCode?: string;
  diagnosisSystem?: "CIE-10" | "CIE-11";
  prognosis?: string;
  treatmentPlan?: string;
  background?: string;
  generalObservations?: string;
}

const vacio = (v: string | undefined) => (v === undefined ? undefined : v.trim() === "" ? null : v.trim());

/**
 * La psicóloga escribe la historia clínica y las observaciones. Con la historia
 * cerrada solo se pueden cambiar las observaciones generales (el trigger
 * `trg_historia_cerrada_inmutable` lo garantiza también en la base).
 */
export async function updateClinicalRecord(
  auth: AuthenticatedUser,
  patientId: string,
  input: UpdateClinicalRecordInput,
  ctx?: ContextoAuditoria,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);
  const recordId = await ensureClinicalRecordId(patientId);
  const actual = await prisma.expedientes_clinicos.findUniqueOrThrow({
    where: { id: recordId },
    select: { historia_estado: true },
  });
  const { generalObservations, ...historia } = input;
  const tocaHistoria = Object.values(historia).some((v) => v !== undefined);
  if (tocaHistoria && actual.historia_estado === estado_nota.CERRADA) {
    throw AppError.conflict("La historia clínica está cerrada: ya no se modifica. Agrega una nota aclaratoria.");
  }

  // Solo los apartados con texto; un apartado vacío se quita.
  let examen: Record<string, string> | undefined;
  if (input.mentalExam) {
    examen = {};
    for (const k of APARTADOS_EXAMEN_MENTAL) {
      const texto = vacio(input.mentalExam[k]);
      if (texto) examen[k] = texto;
    }
  }

  await prisma.expedientes_clinicos.update({
    where: { id: recordId },
    data: {
      motivo_consulta: vacio(input.chiefComplaint),
      problema_actual: vacio(input.currentProblem),
      antecedentes_heredofamiliares: vacio(input.familyHistory),
      antecedentes_no_patologicos: vacio(input.nonPathologicalHistory),
      antecedentes_patologicos: vacio(input.pathologicalHistory),
      examen_mental: examen,
      pruebas_psicometricas: vacio(input.psychometricTests),
      diagnostico: vacio(input.diagnosis),
      diagnostico_codigo: vacio(input.diagnosisCode)?.toUpperCase(),
      diagnostico_sistema: input.diagnosisSystem,
      pronostico: vacio(input.prognosis),
      plan_terapeutico: vacio(input.treatmentPlan),
      antecedentes: vacio(input.background),
      observaciones_generales: vacio(generalObservations),
    },
  });
  await auditar(ctx, "EDITAR_HISTORIA", "expediente", patientId, { campos: Object.keys(input) });
  return cargarExpediente(patientId);
}

/** Campos de la historia que entran al sello, en orden fijo. */
const camposDeHistoria = (row: ClinicalRecordRow): string[] => {
  const examen = examenDe(row.examen_mental) ?? {};
  return [
    row.motivo_consulta ?? "",
    row.problema_actual ?? "",
    row.antecedentes ?? "",
    row.antecedentes_heredofamiliares ?? "",
    row.antecedentes_no_patologicos ?? "",
    row.antecedentes_patologicos ?? "",
    ...APARTADOS_EXAMEN_MENTAL.map((k) => examen[k] ?? ""),
    row.pruebas_psicometricas ?? "",
    row.diagnostico ?? "",
    row.diagnostico_codigo ?? "",
    row.diagnostico_sistema ?? "",
    row.pronostico ?? "",
    row.plan_terapeutico ?? "",
  ];
};

/**
 * Cierra la historia clínica (primera sesión): pide la contraseña, la sella con
 * SHA-256 y desde ahí ya no se modifica. Sin historia cerrada no hay notas de
 * evolución.
 */
export async function cerrarHistoria(
  auth: AuthenticatedUser,
  patientId: string,
  password: string,
  ctx?: ContextoAuditoria,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);
  const psicologo = await prisma.psicologos.findUnique({
    where: { usuario_id: auth.id },
    select: { cedula_profesional: true },
  });
  if (!psicologo) throw AppError.forbidden("Solo la psicóloga puede cerrar la historia clínica.");

  const recordId = await ensureClinicalRecordId(patientId);
  const row = await prisma.expedientes_clinicos.findUniqueOrThrow({ where: { id: recordId } });
  if (row.historia_estado === estado_nota.CERRADA) throw AppError.conflict("La historia clínica ya está cerrada.");
  const faltan = [
    !row.motivo_consulta && "motivo de consulta",
    !row.diagnostico && "impresión diagnóstica",
    !row.plan_terapeutico && "plan terapéutico",
  ].filter(Boolean);
  if (faltan.length > 0) throw AppError.badRequest(`Para cerrar la historia falta: ${faltan.join(", ")}.`);

  await confirmarContrasena(auth, password);

  const ahora = new Date();
  await prisma.expedientes_clinicos.update({
    where: { id: recordId },
    data: {
      historia_estado: estado_nota.CERRADA,
      historia_cerrada_en: ahora,
      historia_cerrada_por: auth.id,
      historia_hash: sellar(camposDeHistoria(row), psicologo.cedula_profesional, patientId, ahora),
    },
  });
  await auditar(ctx, "CERRAR_HISTORIA", "expediente", patientId);
  return cargarExpediente(patientId);
}

/**
 * Baja del paciente: nunca se borra. Deja de aparecer en la lista y su expediente
 * se conserva 5 años (NOM-004 5.4).
 */
export async function darDeBajaPaciente(
  auth: AuthenticatedUser,
  patientId: string,
  ctx?: ContextoAuditoria,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);
  const recordId = await ensureClinicalRecordId(patientId);
  const ahora = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.pacientes.update({ where: { id: patientId }, data: { eliminado_en: ahora } });
    await tx.expedientes_clinicos.update({
      where: { id: recordId },
      data: { estado: estado_expediente.INACTIVO, conservar_hasta: fechaDeConservacion(ahora) },
    });
    await auditar(ctx, "BAJA_PACIENTE", "expediente", patientId, undefined, tx);
  });
  return cargarExpediente(patientId);
}

/** Impresión o descarga del expediente completo: solo se registra. */
export async function registrarImpresion(
  auth: AuthenticatedUser,
  patientId: string,
  ctx?: ContextoAuditoria,
): Promise<void> {
  await requirePatientAccess(auth, patientId);
  await auditar(ctx, "IMPRIMIR_EXPEDIENTE", "expediente", patientId);
}

/** Bitácora de auditoría del expediente, de lo más reciente a lo más antiguo. */
export async function listarAuditoria(auth: AuthenticatedUser, patientId: string): Promise<AuditEntry[]> {
  await requirePatientAccess(auth, patientId);
  const filas = await prisma.registros_auditoria.findMany({
    where: { entidad: "expediente", entidad_id: patientId },
    orderBy: { creado_en: "desc" },
    take: 200,
    include: { usuarios: { select: { nombre_completo: true } } },
  });
  return filas.map((f) => ({
    id: f.id,
    userName: f.usuarios?.nombre_completo,
    action: f.accion,
    entity: f.entidad,
    entityId: f.entidad_id ?? undefined,
    ip: f.ip ?? undefined,
    createdAt: f.creado_en,
  }));
}
