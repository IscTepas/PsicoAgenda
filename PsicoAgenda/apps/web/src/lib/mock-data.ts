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
    startTime: new Date(today.getTime() + 1 * 60 * 60 * 1000), // 10:00 hoy
    durationMinutes: 50,
    status: AppointmentStatus.CONFIRMED,
    modality: AppointmentModality.IN_PERSON,
    attendanceStatus: undefined,
    reason: "Seguimiento de ansiedad y técnicas cognitivas",
    notes: "Continuar con registro de pensamientos automáticos.",
    createdAt: new Date("2024-09-25T10:00:00.000Z"),
    updatedAt: new Date("2024-09-25T10:00:00.000Z"),
  },
  {
    id: "apt-2",
    psychologistId: MOCK_PSYCHOLOGIST.id,
    patientId: MOCK_PATIENTS[1].id,
    startTime: new Date(today.getTime() + 3 * 60 * 60 * 1000), // 12:00 hoy
    durationMinutes: 50,
    status: AppointmentStatus.PENDING,
    modality: AppointmentModality.VIRTUAL,
    attendanceStatus: undefined,
    reason: "Primera consulta - Evaluación inicial",
    notes: "Envío de cuestionario pre-consulta pendiente.",
    createdAt: new Date("2024-09-24T10:00:00.000Z"),
    updatedAt: new Date("2024-09-24T10:00:00.000Z"),
  },
  {
    id: "apt-3",
    psychologistId: MOCK_PSYCHOLOGIST.id,
    patientId: MOCK_PATIENTS[2].id,
    startTime: new Date(today.getTime() + 7 * 60 * 60 * 1000), // 16:00 hoy
    durationMinutes: 50,
    status: AppointmentStatus.CONFIRMED,
    modality: AppointmentModality.IN_PERSON,
    attendanceStatus: undefined,
    reason: "Terapia infanto-juvenil y desarrollo",
    notes: "Acompañada por su madre Daniela.",
    createdAt: new Date("2024-09-24T10:00:00.000Z"),
    updatedAt: new Date("2024-09-24T10:00:00.000Z"),
  },
  {
    id: "apt-4",
    psychologistId: MOCK_PSYCHOLOGIST.id,
    patientId: MOCK_PATIENTS[0].id,
    startTime: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), // mañana 11:00
    durationMinutes: 50,
    status: AppointmentStatus.CONFIRMED,
    modality: AppointmentModality.VIRTUAL,
    attendanceStatus: undefined,
    reason: "Sesión de seguimiento virtual",
    notes: "Enlace generado en plataforma.",
    createdAt: new Date("2024-09-26T10:00:00.000Z"),
    updatedAt: new Date("2024-09-26T10:00:00.000Z"),
  },
  {
    id: "apt-5",
    psychologistId: MOCK_PSYCHOLOGIST.id,
    patientId: MOCK_PATIENTS[1].id,
    startTime: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000), // mañana 14:00
    durationMinutes: 50,
    status: AppointmentStatus.CANCELLED,
    modality: AppointmentModality.IN_PERSON,
    attendanceStatus: undefined,
    reason: "Consulta cancelada por el paciente",
    notes: "Avisó con 24h de anticipación por motivos laborales.",
    createdAt: new Date("2024-09-23T10:00:00.000Z"),
    updatedAt: new Date("2024-09-27T10:00:00.000Z"),
  },
  {
    id: "apt-6",
    psychologistId: MOCK_PSYCHOLOGIST.id,
    patientId: MOCK_PATIENTS[2].id,
    startTime: new Date(today.getTime() + 48 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000), // en 2 días 10:00
    durationMinutes: 50,
    status: AppointmentStatus.PENDING,
    modality: AppointmentModality.IN_PERSON,
    attendanceStatus: undefined,
    reason: "Revisión mensual de objetivos terapéuticos",
    notes: "",
    createdAt: new Date("2024-09-22T10:00:00.000Z"),
    updatedAt: new Date("2024-09-22T10:00:00.000Z"),
  },
  {
    id: "apt-7",
    psychologistId: MOCK_PSYCHOLOGIST.id,
    patientId: MOCK_PATIENTS[0].id,
    startTime: new Date(today.getTime() - 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000), // ayer 10:00
    durationMinutes: 50,
    status: AppointmentStatus.COMPLETED,
    modality: AppointmentModality.IN_PERSON,
    attendanceStatus: AttendanceStatus.ATTENDED,
    reason: "Terapia semanal",
    notes: "Avance notable en técnicas de relajación.",
    createdAt: new Date("2024-09-20T10:00:00.000Z"),
    updatedAt: new Date("2024-09-21T10:00:00.000Z"),
  },
  {
    id: "apt-8",
    psychologistId: MOCK_PSYCHOLOGIST.id,
    patientId: MOCK_PATIENTS[1].id,
    startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 18:00 hoy
    durationMinutes: 50,
    status: AppointmentStatus.CONFIRMED,
    modality: AppointmentModality.IN_PERSON,
    attendanceStatus: undefined,
    reason: "Sesión de cierre semanal y regulación de estrés",
    notes: "Revisar acuerdos de la sesión previa.",
    createdAt: new Date("2024-09-26T10:00:00.000Z"),
    updatedAt: new Date("2024-09-26T10:00:00.000Z"),
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
  background: "Antecedentes familiares de ansiedad en línea materna. Inicio de sintomatología hace 2 años posterior a evento de estrés laboral agudo.",
  allergies: "Sin alergias medicamentosas conocidas. Intolerancia a la cafeína y estimulantes.",
  generalObservations: "Paciente con excelente adherencia al tratamiento. Práctica regular de técnicas cognitivo-conductuales y registro diario de pensamientos automáticos.",
  status: RecordStatus.ACTIVE,
  updatedAt: new Date("2024-09-25T10:00:00.000Z"),
}

export interface SessionLogEntry {
  id: string
  patientId: string
  appointmentId?: string
  sessionNumber: number
  date: Date
  psychologistName: string
  modality: AppointmentModality
  sessionType: string
  notes: string
  interventions?: string
  homework?: string
  createdAt: Date
  updatedAt?: Date
}

export const MOCK_SESSION_LOGS: SessionLogEntry[] = [
  {
    id: "log-3",
    patientId: "patient-1",
    appointmentId: "apt-7",
    sessionNumber: 3,
    date: new Date(today.getTime() - 24 * 60 * 60 * 1000 + 1 * 60 * 60 * 1000), // ayer
    psychologistName: "Dra. Ana García",
    modality: AppointmentModality.IN_PERSON,
    sessionType: "Seguimiento terapéutico",
    notes: "La paciente refiere una disminución notable en la frecuencia de crisis de angustia nocturnas. Reporta haber utilizado la respiración diafragmática en dos ocasiones de tensión en el trabajo con éxito.",
    interventions: "Revisión de autorregistros de distorsiones cognitivas (catastrofismo). Entrenamiento en detención de pensamiento y reestructuración de ideas sobreexigentes.",
    homework: "Continuar con el autoregistro ABC de pensamientos automáticos y dedicar 15 minutos diarios a la relajación muscular progresiva de Jacobson.",
    createdAt: new Date("2024-09-25T11:00:00.000Z"),
  },
  {
    id: "log-2",
    patientId: "patient-1",
    sessionNumber: 2,
    date: new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000), // hace 8 días
    psychologistName: "Dra. Ana García",
    modality: AppointmentModality.IN_PERSON,
    sessionType: "Psicoeducación y encuadre",
    notes: "Se explicó el modelo cognitivo de la ansiedad y el círculo vicioso entre pensamientos catastrofistas, sensaciones fisiológicas y conductas de evitación. Buena comprensión y motivación de la paciente.",
    interventions: "Psicoeducación sobre la fisiología de la ansiedad. Modelado de respiración diafragmática lenta (4-4-6).",
    homework: "Completar la escala de autoevaluación de síntomas somáticos e identificar tres situaciones desencadenantes durante la semana.",
    createdAt: new Date("2024-09-18T11:00:00.000Z"),
  },
  {
    id: "log-1",
    patientId: "patient-1",
    sessionNumber: 1,
    date: new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000), // hace 15 días
    psychologistName: "Dra. Ana García",
    modality: AppointmentModality.IN_PERSON,
    sessionType: "Entrevista inicial y evaluación",
    notes: "Primera consulta. Motivo de consulta: episodios de taquicardia, opresión torácica y rumiación constante sobre el rendimiento laboral. Sin antecedentes médicos cardiovasculares (descartado por cardiólogo).",
    interventions: "Entrevista clínica semiestructurada, exploración del estado mental y establecimiento del encuadre terapéutico y confidencialidad.",
    homework: "Ninguna asignada (fase diagnóstica).",
    createdAt: new Date("2024-09-11T11:00:00.000Z"),
  },
  {
    id: "log-4",
    patientId: "patient-2",
    sessionNumber: 1,
    date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
    psychologistName: "Dra. Ana García",
    modality: AppointmentModality.VIRTUAL,
    sessionType: "Entrevista clínica inicial",
    notes: "Paciente acude por sintomatología depresiva leve asociada a duelo por cambio de residencia. Afecto aplanado, discurso coherente.",
    interventions: "Validación emocional, anamnesis general y delimitación de objetivos terapéuticos.",
    homework: "Escribir una lista de actividades placenteras cotidianas para activación conductual.",
    createdAt: new Date("2024-09-24T12:00:00.000Z"),
  },
  {
    id: "log-5",
    patientId: "patient-3",
    sessionNumber: 1,
    date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000),
    psychologistName: "Dra. Ana García",
    modality: AppointmentModality.IN_PERSON,
    sessionType: "Sesión inicial con tutora",
    notes: "Acude la menor Sofía acompañada de su madre Daniela. Motivo de consulta: dificultades de adaptación escolar y aislamiento social.",
    interventions: "Firma de consentimiento informado por la tutora legal. Observación lúdica con la menor.",
    homework: "La madre registrará los episodios de llanto o retraimiento en casa.",
    createdAt: new Date("2024-09-20T16:00:00.000Z"),
  },
]

export function getSessionLogsByPatientId(patientId: string): SessionLogEntry[] {
  return MOCK_SESSION_LOGS.filter((log) => log.patientId === patientId).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  )
}

export function getPatientById(id: string): Patient | undefined {
  return MOCK_PATIENTS.find((patient) => patient.id === id)
}

export function getAppointmentsByPatientId(patientId: string): Appointment[] {
  return MOCK_APPOINTMENTS.filter((apt) => apt.patientId === patientId)
}

export function getAppointmentById(id: string): Appointment | undefined {
  return MOCK_APPOINTMENTS.find((apt) => apt.id === id)
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

export function getPatientForUser(user?: { email?: string; id?: string } | null): Patient {
  if (!user?.email) return MOCK_PATIENTS[0]
  const emailLower = user.email.toLowerCase()
  const found = MOCK_PATIENTS.find(
    (p) => p.email.toLowerCase() === emailLower || (emailLower.includes("paciente") && p.id === "patient-1")
  )
  return found || MOCK_PATIENTS[0]
}

export function getAppointmentsForUser(user?: { email?: string; role?: UserRole; id?: string } | null): Appointment[] {
  if (user?.role === UserRole.PATIENT) {
    const patient = getPatientForUser(user)
    return MOCK_APPOINTMENTS.filter((apt) => apt.patientId === patient.id)
  }
  return MOCK_APPOINTMENTS
}

export function getLatestHomeworkForPatient(patientId: string): string[] {
  const patientLogs = getSessionLogsByPatientId(patientId)
  const homeworks: string[] = []
  for (const log of patientLogs) {
    if (log.homework && log.homework.trim() && !log.homework.toLowerCase().includes("ninguna")) {
      homeworks.push(log.homework)
    }
  }
  if (homeworks.length === 0) {
    homeworks.push("Continuar con el autoregistro ABC de pensamientos automáticos.")
    homeworks.push("Dedicar 15 minutos diarios a la relajación muscular progresiva de Jacobson.")
  }
  return homeworks
}
