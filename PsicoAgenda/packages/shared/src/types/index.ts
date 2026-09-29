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
}

export interface Psychologist extends User {
  role: UserRole.PSYCHOLOGIST;
  licenseNumber: string;
  specialty?: string;
  bio?: string;
}

export interface Patient extends User {
  role: UserRole.PATIENT;
  birthDate?: Date;
  gender?: string;
  address?: string;
  isMinor: boolean;
  psychologistId?: string;
  emergencyContact?: EmergencyContact;
  legalGuardian?: LegalGuardian;
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
  email?: string;
  phone?: string;
  documentId?: string;
  relationship?: string;
  createdAt: Date;
}

export interface Appointment {
  id: string;
  psychologistId: string;
  patientId: string;
  startTime: Date;
  durationMinutes: number;
  status: AppointmentStatus;
  modality: AppointmentModality;
  attendanceStatus?: AttendanceStatus;
  reason?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClinicalRecord {
  id: string;
  patientId: string;
  openedAt: Date;
  diagnosis?: string;
  background?: string;
  generalObservations?: string;
  status: RecordStatus;
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

export interface Notification {
  id: string;
  patientId?: string;
  appointmentId?: string;
  channel: NotificationChannel;
  subject: string;
  message: string;
  status: NotificationStatus;
  scheduledFor?: Date;
  sentAt?: Date;
  error?: string;
  attempts: number;
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
