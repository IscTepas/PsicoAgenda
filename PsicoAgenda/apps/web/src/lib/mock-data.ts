import {
  AppointmentStatus,
  AppointmentModality,
  AttendanceStatus,
  NotificationStatus,
  NotificationChannel,
  RecordStatus,
  UserRole,
  type Appointment,
  type Notification,
  type Patient,
  type Psychologist,
} from "@psicoagenda/shared"

export const MOCK_PSYCHOLOGIST: Psychologist = {
  id: "user-1",
  email: "ana.garcia@psicoagenda.test",
  name: "Dra. Ana García",
  phone: "+52 55 1234 5678",
  role: UserRole.PSYCHOLOGIST,
  licenseNumber: "Psic. 12345",
  specialty: "Psicología clínica",
  bio: "Especialista en terapia cognitivo-conductual y manejo de ansiedad.",
  createdAt: new Date("2024-01-15T10:00:00.000Z"),
  updatedAt: new Date("2024-09-20T10:00:00.000Z"),
}

export const MOCK_PATIENTS: Patient[] = [
  {
    id: "patient-1",
    email: "maria.lopez@correo.test",
    name: "María López",
    phone: "+52 55 9876 5432",
    role: UserRole.PATIENT,
    birthDate: new Date("1990-05-12T00:00:00.000Z"),
    gender: "femenino",
    address: "Ciudad de México",
    isMinor: false,
    psychologistId: MOCK_PSYCHOLOGIST.id,
    emergencyContact: {
      id: "contact-1",
      patientId: "patient-1",
      name: "Carlos López",
      phone: "+52 55 1111 2222",
      relationship: "Hermano",
      isPrimary: true,
      createdAt: new Date("2024-01-20T10:00:00.000Z"),
    },
    createdAt: new Date("2024-01-20T10:00:00.000Z"),
    updatedAt: new Date("2024-09-25T10:00:00.000Z"),
  },
  {
    id: "patient-2",
    email: "luis.hernandez@correo.test",
    name: "Luis Hernández",
    phone: "+52 55 3333 4444",
    role: UserRole.PATIENT,
    birthDate: new Date("1985-08-03T00:00:00.000Z"),
    gender: "masculino",
    address: "Guadalajara, Jalisco",
    isMinor: false,
    psychologistId: MOCK_PSYCHOLOGIST.id,
    emergencyContact: {
      id: "contact-2",
      patientId: "patient-2",
      name: "Patricia Hernández",
      phone: "+52 55 5555 6666",
      relationship: "Esposa",
      isPrimary: true,
      createdAt: new Date("2024-02-10T10:00:00.000Z"),
    },
    createdAt: new Date("2024-02-10T10:00:00.000Z"),
    updatedAt: new Date("2024-09-26T10:00:00.000Z"),
  },
  {
    id: "patient-3",
    email: "sofia.martinez.padres@correo.test",
    name: "Sofía Martínez",
    phone: undefined,
    role: UserRole.PATIENT,
    birthDate: new Date("2016-11-20T00:00:00.000Z"),
    gender: "femenino",
    address: "Monterrey, Nuevo León",
    isMinor: true,
    psychologistId: MOCK_PSYCHOLOGIST.id,
    legalGuardian: {
      id: "guardian-1",
      name: "Daniela Martínez",
      email: "daniela.martinez@correo.test",
      phone: "+52 81 7777 8888",
      documentId: "MARD901122ABC",
      relationship: "Madre",
      createdAt: new Date("2024-03-05T10:00:00.000Z"),
    },
    emergencyContact: {
      id: "contact-3",
      patientId: "patient-3",
      name: "Daniela Martínez",
      phone: "+52 81 7777 8888",
      relationship: "Madre",
      isPrimary: true,
      createdAt: new Date("2024-03-05T10:00:00.000Z"),
    },
    createdAt: new Date("2024-03-05T10:00:00.000Z"),
    updatedAt: new Date("2024-09-26T10:00:00.000Z"),
  },
]

const today = new Date()
today.setHours(9, 0, 0, 0)

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: "apt-1",
    psychologistId: MOCK_PSYCHOLOGIST.id,
    patientId: MOCK_PATIENTS[0].id,
    startTime: new Date(today.getTime() + 2 * 60 * 60 * 1000),
    durationMinutes: 50,
    status: AppointmentStatus.CONFIRMED,
    modality: AppointmentModality.IN_PERSON,
    attendanceStatus: undefined,
    reason: "Seguimiento semanal",
    notes: "",
    createdAt: new Date("2024-09-25T10:00:00.000Z"),
    updatedAt: new Date("2024-09-25T10:00:00.000Z"),
  },
  {
    id: "apt-2",
    psychologistId: MOCK_PSYCHOLOGIST.id,
    patientId: MOCK_PATIENTS[1].id,
    startTime: new Date(today.getTime() + 5 * 60 * 60 * 1000),
    durationMinutes: 50,
    status: AppointmentStatus.PENDING,
    modality: AppointmentModality.VIRTUAL,
    attendanceStatus: undefined,
    reason: "Primera consulta",
    notes: "",
    createdAt: new Date("2024-09-24T10:00:00.000Z"),
    updatedAt: new Date("2024-09-24T10:00:00.000Z"),
  },
  {
    id: "apt-3",
    psychologistId: MOCK_PSYCHOLOGIST.id,
    patientId: MOCK_PATIENTS[0].id,
    startTime: new Date(today.getTime() - 24 * 60 * 60 * 1000),
    durationMinutes: 50,
    status: AppointmentStatus.COMPLETED,
    modality: AppointmentModality.IN_PERSON,
    attendanceStatus: AttendanceStatus.ATTENDED,
    reason: "Terapia semanal",
    notes: "Avance notable en técnicas de relajación.",
    createdAt: new Date("2024-09-20T10:00:00.000Z"),
    updatedAt: new Date("2024-09-21T10:00:00.000Z"),
  },
]

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    patientId: MOCK_PATIENTS[0].id,
    appointmentId: MOCK_APPOINTMENTS[0].id,
    channel: NotificationChannel.EMAIL,
    subject: "Recordatorio de cita",
    message: "Tienes una cita programada para mañana a las 11:00.",
    status: NotificationStatus.SENT,
    scheduledFor: new Date(today.getTime() - 12 * 60 * 60 * 1000),
    sentAt: new Date(today.getTime() - 12 * 60 * 60 * 1000),
    attempts: 1,
    createdAt: new Date("2024-09-26T10:00:00.000Z"),
  },
  {
    id: "notif-2",
    patientId: MOCK_PATIENTS[1].id,
    appointmentId: MOCK_APPOINTMENTS[1].id,
    channel: NotificationChannel.WHATSAPP,
    subject: "Confirma tu cita",
    message: "Por favor confirma tu asistencia a la cita de hoy.",
    status: NotificationStatus.PENDING,
    scheduledFor: new Date(today.getTime() + 1 * 60 * 60 * 1000),
    attempts: 0,
    createdAt: new Date("2024-09-27T08:00:00.000Z"),
  },
]

export const MOCK_CLINICAL_RECORD = {
  id: "record-1",
  patientId: MOCK_PATIENTS[0].id,
  openedAt: new Date("2024-01-20T10:00:00.000Z"),
  diagnosis: "Trastorno de ansiedad generalizada (F41.1)",
  background: "Antecedentes familiares de ansiedad. Inicio de síntomas hace 2 años.",
  generalObservations: "Paciente con buena adherencia al tratamiento.",
  status: RecordStatus.ACTIVE,
  updatedAt: new Date("2024-09-25T10:00:00.000Z"),
}

export function getPatientById(id: string): Patient | undefined {
  return MOCK_PATIENTS.find((patient) => patient.id === id)
}

export function getAppointmentsByPatientId(patientId: string): Appointment[] {
  return MOCK_APPOINTMENTS.filter((apt) => apt.patientId === patientId)
}

export function formatAppointmentTime(date: Date): string {
  return date.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })
}
