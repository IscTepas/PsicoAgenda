import type {
  EmergencyContact,
  LegalGuardian,
  Patient,
  PatientProfile,
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
  extends Omit<Patient, "birthDate" | "createdAt" | "updatedAt" | "emergencyContact" | "legalGuardian"> {
  birthDate?: string
  createdAt: string
  updatedAt: string
  emergencyContact?: SerializedContact
  legalGuardian?: SerializedGuardian
}

function revivePatient(raw: SerializedPatient): Patient {
  return {
    ...raw,
    birthDate: raw.birthDate ? new Date(raw.birthDate) : undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    emergencyContact: raw.emergencyContact
      ? { ...raw.emergencyContact, createdAt: new Date(raw.emergencyContact.createdAt) }
      : undefined,
    legalGuardian: raw.legalGuardian
      ? { ...raw.legalGuardian, createdAt: new Date(raw.legalGuardian.createdAt) }
      : undefined,
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
}
