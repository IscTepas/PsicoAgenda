import { randomUUID } from "node:crypto";
import {
  ConsentStatus as SharedConsentStatus,
  RecordStatus as SharedRecordStatus,
  UserRole,
  type ClinicalRecord,
  type InformedConsent,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { estado_consentimiento, estado_expediente } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/utils/jwt";
import { AppError } from "@/utils/app-error";

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
    documentUrl: row.documento_url ?? undefined,
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

const toClinicalRecord = (row: ClinicalRecordRow, consents: ConsentRow[]): ClinicalRecord => ({
  id: row.id,
  patientId: row.paciente_id,
  openedAt: row.abierto_en,
  diagnosis: row.diagnostico ?? undefined,
  background: row.antecedentes ?? undefined,
  generalObservations: row.observaciones_generales ?? undefined,
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

/**
 * Devuelve el expediente del paciente, creándolo de forma perezosa si aún no
 * existe. El expediente nace con los datos que ya se conocen del paciente.
 */
export async function getOrCreateClinicalRecord(
  auth: AuthenticatedUser,
  patientId: string,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);

  const [existing, consents] = await Promise.all([
    prisma.expedientes_clinicos.findUnique({ where: { paciente_id: patientId } }),
    cargarConsentimientos(patientId),
  ]);
  if (existing) return toClinicalRecord(existing, consents);

  const created = await prisma.expedientes_clinicos.create({
    data: { id: randomUUID(), paciente_id: patientId },
  });

  return toClinicalRecord(created, consents);
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

export interface CreateConsentInput {
  signedAt: string; // YYYY-MM-DD
  document: string;
  guardianId?: string;
}

const esMenor = (nacimiento: Date | null) => {
  if (!nacimiento) return false;
  const mayoria = new Date(nacimiento);
  mayoria.setFullYear(nacimiento.getFullYear() + 18);
  return mayoria > new Date();
};

/**
 * Registra el consentimiento que se firmó (en papel o en consultorio). Un menor
 * lo firma uno de sus tutores; un adulto, él mismo. El nuevo reemplaza al que
 * estaba vigente, que pasa a VENCIDO (no se borra: queda como historial).
 */
export async function registrarConsentimiento(
  auth: AuthenticatedUser,
  patientId: string,
  input: CreateConsentInput,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);
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

  await prisma.$transaction([
    prisma.consentimientos_informados.updateMany({
      where: { paciente_id: patientId, estado: estado_consentimiento.FIRMADO },
      data: { estado: estado_consentimiento.VENCIDO },
    }),
    prisma.consentimientos_informados.create({
      data: {
        id: randomUUID(),
        paciente_id: patientId,
        // Mediodía local para que la fecha no se corra de día por la zona horaria.
        firmado_en: new Date(`${input.signedAt}T12:00:00`),
        documento: input.document.trim(),
        tutor_legal_id: input.guardianId ?? null,
      },
    }),
  ]);
  return getOrCreateClinicalRecord(auth, patientId);
}

/** El paciente (o su tutor) retira el consentimiento: queda registrado cuándo. */
export async function retirarConsentimiento(
  auth: AuthenticatedUser,
  patientId: string,
  consentId: string,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);
  const { count } = await prisma.consentimientos_informados.updateMany({
    where: { id: consentId, paciente_id: patientId, estado: estado_consentimiento.FIRMADO },
    data: { estado: estado_consentimiento.RETIRADO, retirado_en: new Date() },
  });
  if (count === 0) throw AppError.notFound("No hay un consentimiento vigente con ese identificador.");
  return getOrCreateClinicalRecord(auth, patientId);
}

export interface UpdateClinicalRecordInput {
  diagnosis?: string;
  background?: string;
  generalObservations?: string;
}

/** La psicóloga escribe diagnóstico, antecedentes y observaciones del expediente. */
export async function updateClinicalRecord(
  auth: AuthenticatedUser,
  patientId: string,
  input: UpdateClinicalRecordInput,
): Promise<ClinicalRecord> {
  await requirePatientAccess(auth, patientId);
  const recordId = await ensureClinicalRecordId(patientId);
  const vacio = (v: string | undefined) => (v === undefined ? undefined : v.trim() === "" ? null : v.trim());

  const updated = await prisma.expedientes_clinicos.update({
    where: { id: recordId },
    data: {
      diagnostico: vacio(input.diagnosis),
      antecedentes: vacio(input.background),
      observaciones_generales: vacio(input.generalObservations),
    },
  });
  return toClinicalRecord(updated, await cargarConsentimientos(patientId));
}
