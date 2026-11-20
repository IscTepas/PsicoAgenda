import type { PricingRates } from "../pricing/index.js";

export enum UserRole {
  PSYCHOLOGIST = "psychologist",
  PATIENT = "patient",
  ADMIN = "admin",
}

export enum AppointmentStatus {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  CANCELLED = "cancelled",
  COMPLETED = "completed",
  NO_SHOW = "no_show",
}

export enum AppointmentModality {
  IN_PERSON = "in_person",
  VIRTUAL = "virtual",
}

export enum AttendanceStatus {
  ATTENDED = "attended",
  NO_SHOW = "no_show",
}

export enum RecordStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export enum NotificationStatus {
  PENDING = "pending",
  SENT = "sent",
  FAILED = "failed",
  CANCELLED = "cancelled",
}

export enum NotificationChannel {
  WHATSAPP = "whatsapp",
  EMAIL = "email",
  /** Aviso dentro de la aplicación (campana). */
  SYSTEM = "system",
}

export enum ConsentStatus {
  SIGNED = "signed",
  WITHDRAWN = "withdrawn",
  EXPIRED = "expired",
}

export enum ReportFormat {
  PDF = "pdf",
  XLSX = "xlsx",
}

export enum PaymentStatus {
  PENDING = "pending",
  PAID = "paid",
  WAIVED = "waived",
}

/**
 * Identidad en la base de datos de la aplicación. Es un perfil espejado de la
 * identidad del proveedor: no guarda contraseñas ni su equivalente cifrado.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Datos de la sesión que consume la interfaz.
 *
 * - `id` y `email` los emite el proveedor de identidad (`sub` y `email` del token).
 * - `role` lo declara el proveedor en `app_metadata.role`; una sesión sin rol se
 *   rechaza en lugar de degradar al de menor privilegio.
 * - `name` proviene del perfil espejado, no del token.
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** Foto de perfil (data URL comprimida o URL http). */
  photoUrl?: string;
}

export interface Psychologist extends User {
  role: UserRole.PSYCHOLOGIST;
  licenseNumber: string;
  specialty?: string;
  bio?: string;
  /** Tarifas con las que se calcula el costo de sus citas. */
  rates: PricingRates;
  /** Enlace fijo de su sala de videollamada (Meet, Zoom…), si lo configuró. */
  videoCallUrl?: string;
  /** Carátula del expediente (NOM-004). */
  facilityName?: string;
  facilityType?: string;
  facilityAddress?: string;
}

/** Preferencias de cuenta que aplican a cualquier rol. */
export interface ProfilePreferences {
  timeZone: string;
  photoUrl?: string;
  notifyWhatsapp: boolean;
  notifyEmail: boolean;
}

export interface PsychologistProfile extends Psychologist, ProfilePreferences {}

export interface PatientProfile extends Patient, ProfilePreferences {}

/**
 * Entrada de bitácora tal como la consume la interfaz clínica. Es la proyección
 * legible de `LogEntry` (que guarda `sessionNotes`/`objectives`/`nextSessionPlan`).
 */
export interface SessionLogEntry {
  id: string;
  patientId: string;
  appointmentId?: string;
  sessionNumber: number;
  date: Date;
  psychologistName: string;
  modality: AppointmentModality;
  sessionType: string;
  notes: string;
  interventions?: string;
  homework?: string;
  /** Tareas que se dejaron en esta sesión. */
  tasks: SessionTask[];
  /** Tipo de nota (NOM-004): evolución, aclaratoria, interconsulta/referencia o egreso. */
  kind: NoteKind;
  /** Borrador (editable) o cerrada (sellada, ya no se modifica). */
  status: NoteStatus;
  closedAt?: Date;
  closedByName?: string;
  /** Cédula de quien cerró la nota. */
  closedByLicense?: string;
  /** Sello SHA-256 de la nota cerrada. */
  hash?: string;
  /** Nota que aclara (solo en aclaratorias). */
  parentId?: string;
  referredTo?: string;
  referralReason?: string;
  dischargeReason?: string;
  dischargeSummary?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export type NoteKind = "evolution" | "clarification" | "referral" | "discharge";
export type NoteStatus = "draft" | "closed";

/** Examen del estado mental de la historia clínica. */
export interface MentalExam {
  apariencia?: string;
  conducta?: string;
  animo?: string;
  lenguaje?: string;
  pensamiento?: string;
  memoria?: string;
  orientacion?: string;
  juicio?: string;
}

/** Carátula del expediente: establecimiento y profesional responsable. */
export interface RecordFacility {
  name?: string;
  type: string;
  address?: string;
  psychologistName?: string;
  licenseNumber?: string;
}

/** Un renglón de la bitácora de auditoría del expediente. */
export interface AuditEntry {
  id: string;
  userName?: string;
  action: string;
  entity: string;
  entityId?: string;
  ip?: string;
  createdAt: Date;
}

export interface SessionTask {
  id: string;
  text: string;
  /** Cuándo la marcó como hecha el paciente (o su tutor). */
  doneAt?: Date;
}

/** Tarea tal como la ve el paciente en su inicio. */
export interface PatientTask extends SessionTask {
  patientId: string;
  /** Nombre del menor a cargo, si la tarea no es de la propia cuenta. */
  patientName?: string;
  sessionDate: Date;
}

export interface Patient extends User {
  role: UserRole.PATIENT;
  birthDate?: Date;
  gender?: string;
  address?: string;
  isMinor: boolean;
  psychologistId?: string;
  emergencyContact?: EmergencyContact;
  /** Tutor principal (atajo de `guardians`). */
  legalGuardian?: LegalGuardian;
  /** Todos los tutores vinculados; solo aplican mientras el paciente es menor. */
  guardians?: LegalGuardian[];
  /** Fecha en que terminó la tutela al cumplir 18 años, si ocurrió. */
  guardianshipEndedAt?: Date;
  /** Sin cuenta: lo dio de alta la psicóloga para una cita única. */
  oneTime?: boolean;
}

/** Menor que la cuenta autenticada tutela (para agendar a su nombre). */
export interface TutoredPatient {
  id: string;
  name: string;
}

export interface EmergencyContact {
  id: string;
  patientId?: string;
  name: string;
  phone: string;
  relationship?: string;
  isPrimary: boolean;
  createdAt: Date;
}

export interface LegalGuardian {
  id: string;
  name: string;
  phone?: string;
  relationship?: string;
  /** Correo de su cuenta, si el tutor tiene una. */
  email?: string;
  hasAccount?: boolean;
  isPrimary?: boolean;
  createdAt: Date;
}

/** Tipo de sesión de la cita (citas.tipo_sesion). */
export type AppointmentSessionType = "initial" | "individual" | "couple" | "family";

export interface Appointment {
  id: string;
  psychologistId: string;
  patientId: string;
  startTime: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  modality: AppointmentModality;
  attendanceStatus?: AttendanceStatus;
  sessionType?: AppointmentSessionType;
  /** Para mostrar: etiquetas del catálogo unidas, más el texto de «Otro» (o el texto histórico). */
  reason?: string;
  reasonIds?: string[];
  /** Lo escrito en «Otro», si se eligió (para poder editarlo). */
  reasonOther?: string;
  notes?: string;
  /** Por qué se canceló (o se movió a otra fecha), si está cancelada. */
  cancellationReason?: string;
  /** La canceló la psicóloga (o un bloqueo de agenda), no el paciente: hay que avisarle. */
  cancelledByPsychologist?: boolean;
  /** Cuándo se canceló. */
  cancelledAt?: Date;
  /** La sesión ya tiene su hoja de bitácora. */
  hasSessionNote?: boolean;
  price?: number;
  payment?: HonorariumPayment;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rango en el que el psicólogo no atiende. El intervalo es semiabierto
 * `[startTime, endTime)`: un bloqueo que termina a las 11:00 no choca con una
 * cita que empieza a las 11:00.
 */
export interface AgendaBlock {
  id: string;
  psychologistId: string;
  startTime: Date;
  endTime: Date;
  /** Bandera de presentación: el rango ya viene calculado como instantes. */
  allDay: boolean;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum AppointmentRequestStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}

/**
 * Lo que el paciente pide. No ocupa agenda: la cita (`Appointment`) solo existe
 * cuando el psicólogo la acepta, y entonces `appointmentId` apunta a ella.
 */
export interface AppointmentRequest {
  id: string;
  patientId: string;
  psychologistId: string;
  startTime: Date;
  durationMinutes: number;
  modality: AppointmentModality;
  /** Para mostrar: etiquetas del catálogo unidas, más el texto de «Otro» (o el texto histórico). */
  reason?: string;
  reasonIds?: string[];
  /** Lo escrito en «Otro», si se eligió (para poder editarlo). */
  reasonOther?: string;
  status: AppointmentRequestStatus;
  appointmentId?: string;
  /** La propuso la psicóloga (cambio de horario de una cita): la responde el paciente. */
  proposedByPsychologist: boolean;
  /** Cita que cambia si el paciente acepta la propuesta. */
  originalAppointmentId?: string;
  /** Horario actual de esa cita, para mostrar "de … a …". */
  originalStartTime?: Date;
  createdAt: Date;
  handledAt?: Date;
}

/** Motivo del catálogo de consulta (`motivos_consulta`). */
export interface ConsultationReason {
  id: string;
  code: string;
  label: string;
  category: string;
  active: boolean;
  order: number;
  isOther: boolean;
  requiresText: boolean;
}

export interface ConsultationReasonGroup {
  category: string;
  reasons: ConsultationReason[];
}

export interface ClinicalRecord {
  id: string;
  patientId: string;
  /** Número de expediente consecutivo (se muestra como EXP-000123). */
  folio: number;
  openedAt: Date;
  facility: RecordFacility;
  /** Historia clínica: interrogatorio. */
  chiefComplaint?: string;
  currentProblem?: string;
  familyHistory?: string;
  nonPathologicalHistory?: string;
  pathologicalHistory?: string;
  /** Historia clínica: exploración y evaluación. */
  mentalExam?: MentalExam;
  psychometricTests?: string;
  /** Historia clínica: conclusión. */
  diagnosis?: string;
  diagnosisCode?: string;
  diagnosisSystem?: "CIE-10" | "CIE-11";
  prognosis?: string;
  treatmentPlan?: string;
  /** Antecedentes del registro anterior (todo junto); solo lectura. */
  background?: string;
  generalObservations?: string;
  historyStatus: NoteStatus;
  historyClosedAt?: Date;
  historyHash?: string;
  /** Hasta cuándo se conserva el expediente (5 años tras el egreso o la baja). */
  retainUntil?: Date;
  status: RecordStatus;
  /** Consentimientos del paciente, del más reciente al más antiguo. */
  consents: InformedConsent[];
  updatedAt: Date;
}

export interface LogEntry {
  id: string;
  clinicalRecordId: string;
  appointmentId?: string;
  sessionDate: Date;
  sessionNotes: string;
  psychologistId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Qué aviso es (notificaciones.tipo): decide qué hace la interfaz al abrirlo. */
export type NotificationKind =
  | "reminder"
  | "confirmation"
  | "change"
  | "cancellation"
  | "request"
  | "rejection"
  | "attendance"
  | "homework";

export interface Notification {
  id: string;
  patientId?: string;
  appointmentId?: string;
  /** Solicitud a la que se refiere el aviso, si es de una solicitud. */
  requestId?: string;
  kind: NotificationKind;
  channel: NotificationChannel;
  subject: string;
  message: string;
  status: NotificationStatus;
  scheduledFor?: Date;
  sentAt?: Date;
  error?: string;
  attempts: number;
  readAt?: Date;
  externalMessageId?: string;
  deliveryStatus?: string;
  deliveredAt?: Date;
  createdAt: Date;
}

export interface InformedConsent {
  id: string;
  patientId: string;
  signedAt: Date;
  document: string;
  documentUrl?: string;
  legalGuardianId?: string;
  legalGuardian?: LegalGuardian;
  status: ConsentStatus;
  withdrawnAt?: Date;
  /** Firma dibujada en pantalla (data URL PNG). */
  signatureImage?: string;
  /** Hay PDF firmado guardado (se abre con un enlace temporal). */
  hasPdf: boolean;
  privacyNoticeAccepted: boolean;
  createdAt: Date;
}

export interface Report {
  id: string;
  type: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
  format: ReportFormat;
  fileUrl?: string;
  generatedById?: string;
}

export interface HonorariumPayment {
  id: string;
  appointmentId: string;
  amount: string; // Decimal serializado como string
  status: PaymentStatus;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}


export interface PsychologistScheduleSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface PsychologistSchedule {
  psychologistId: string;
  slots: PsychologistScheduleSlot[];
  seeded: boolean;
}
