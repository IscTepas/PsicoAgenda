import type {
  EmergencyContact,
  LegalGuardian,
  Patient,
  PatientProfile,
  TutoredPatient,
} from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

/**
 * Las fechas viajan como cadenas ISO desde la API; aquí recuperan su forma `Date`
 * antes de entrar a los componentes, que comparan y formatean fechas.
 */
interface SerializedContact extends Omit<EmergencyContact, "createdAt"> {
  createdAt: string
}

interface SerializedGuardian extends Omit<LegalGuardian, "createdAt"> {
  createdAt: string
}

interface SerializedPatient
  extends Omit<
    Patient,
    "birthDate" | "createdAt" | "updatedAt" | "emergencyContact" | "legalGuardian" | "guardians" | "guardianshipEndedAt"
  > {
  birthDate?: string
  createdAt: string
  updatedAt: string
  emergencyContact?: SerializedContact
  legalGuardian?: SerializedGuardian
  guardians?: SerializedGuardian[]
  guardianshipEndedAt?: string
}

const reviveGuardian = (raw: SerializedGuardian): LegalGuardian => ({ ...raw, createdAt: new Date(raw.createdAt) })

function revivePatient(raw: SerializedPatient): Patient {
  return {
    ...raw,
    birthDate: raw.birthDate ? new Date(raw.birthDate) : undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    emergencyContact: raw.emergencyContact
      ? { ...raw.emergencyContact, createdAt: new Date(raw.emergencyContact.createdAt) }
      : undefined,
    legalGuardian: raw.legalGuardian ? reviveGuardian(raw.legalGuardian) : undefined,
    guardians: raw.guardians?.map(reviveGuardian),
    guardianshipEndedAt: raw.guardianshipEndedAt ? new Date(raw.guardianshipEndedAt) : undefined,
  }
}

export interface PatientListParams {
  limit?: number
  offset?: number
  page?: number
}

function buildQuery(params: PatientListParams = {}): string {
  const search = new URLSearchParams()
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  if (params.page !== undefined) search.set("page", String(params.page))
  const q = search.toString()
  return q ? `?${q}` : ""
}

interface SerializedPatientProfile extends SerializedPatient {
  timeZone: string
  photoUrl?: string
  notifyWhatsapp: boolean
  notifyEmail: boolean
}

function revivePatientProfile(raw: SerializedPatientProfile): PatientProfile {
  return {
    ...revivePatient(raw),
    timeZone: raw.timeZone,
    photoUrl: raw.photoUrl,
    notifyWhatsapp: raw.notifyWhatsapp,
    notifyEmail: raw.notifyEmail,
  }
}

export interface UpdatePatientProfilePayload {
  name?: string
  phone?: string
  timeZone?: string
  photoUrl?: string
  notifyWhatsapp?: boolean
  notifyEmail?: boolean
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelationship?: string
}

export const patientService = {
  list: async (params: PatientListParams | string = {}, token?: string): Promise<Patient[]> => {
    if (typeof params === "string") {
      const rows = await apiFetch<SerializedPatient[]>("/patients", { token })
      return rows.map(revivePatient)
    }
    const rows = await apiFetch<SerializedPatient[]>(`/patients${buildQuery(params)}`, { token })
    return rows.map(revivePatient)
  },

  get: async (id: string, token?: string): Promise<Patient> =>
    revivePatient(await apiFetch<SerializedPatient>(`/patients/${id}`, { token })),

  getMe: async (): Promise<PatientProfile> =>
    revivePatientProfile(await apiFetch<SerializedPatientProfile>("/patients/me")),

  updateProfile: async (payload: UpdatePatientProfilePayload): Promise<PatientProfile> =>
    revivePatientProfile(
      await apiFetch<SerializedPatientProfile>("/patients/me", {
        method: "PATCH",
        body: payload,
      }),
    ),

  /** Menores que tutela la cuenta (para pedir citas a su nombre). */
  listTutored: (): Promise<TutoredPatient[]> => apiFetch<TutoredPatient[]>("/patients/me/tutelados"),
}

export interface AddGuardianPayload {
  email?: string
  name?: string
  phone?: string
  relationship?: string
  isPrimary?: boolean
}

/** Tutores de un paciente; los gestiona el psicólogo tratante desde el expediente. */
export const guardianService = {
  list: async (patientId: string): Promise<LegalGuardian[]> =>
    (await apiFetch<SerializedGuardian[]>(`/patients/${patientId}/tutores`)).map(reviveGuardian),
  add: async (patientId: string, payload: AddGuardianPayload): Promise<LegalGuardian[]> =>
    (await apiFetch<SerializedGuardian[]>(`/patients/${patientId}/tutores`, { method: "POST", body: payload })).map(
      reviveGuardian,
    ),
  setPrimary: async (patientId: string, tutorId: string): Promise<LegalGuardian[]> =>
    (
      await apiFetch<SerializedGuardian[]>(`/patients/${patientId}/tutores/${tutorId}/principal`, { method: "POST" })
    ).map(reviveGuardian),
  remove: async (
    patientId: string,
    tutorId: string,
    options: { nuevoPrincipalId?: string; sinPrincipal?: boolean } = {},
  ): Promise<LegalGuardian[]> => {
    const query = new URLSearchParams()
    if (options.nuevoPrincipalId) query.set("nuevoPrincipalId", options.nuevoPrincipalId)
    if (options.sinPrincipal) query.set("sinPrincipal", "true")
    const q = query.toString() ? `?${query}` : ""
    return (
      await apiFetch<SerializedGuardian[]>(`/patients/${patientId}/tutores/${tutorId}${q}`, { method: "DELETE" })
    ).map(reviveGuardian)
  },
}
