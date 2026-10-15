import type { PsychologistProfile } from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

/** La API serializa las fechas como ISO; el dominio las usa como `Date`. */
interface SerializedPsychologistProfile
  extends Omit<PsychologistProfile, "createdAt" | "updatedAt"> {
  createdAt: string
  updatedAt: string
}

function reviveProfile(raw: SerializedPsychologistProfile): PsychologistProfile {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  }
}

export interface UpdatePsychologistProfilePayload {
  name?: string
  phone?: string
  timeZone?: string
  photoUrl?: string
  notifyWhatsapp?: boolean
  notifyEmail?: boolean
  licenseNumber?: string
  specialty?: string
  bio?: string
}

export const psychologistService = {
  getMe: async (token?: string): Promise<PsychologistProfile> =>
    reviveProfile(
      await apiFetch<SerializedPsychologistProfile>("/psychologists/me", { token }),
    ),

  getById: async (id: string, token?: string): Promise<PsychologistProfile> =>
    reviveProfile(
      await apiFetch<SerializedPsychologistProfile>(`/psychologists/${id}`, { token }),
    ),

  updateMe: async (payload: UpdatePsychologistProfilePayload): Promise<PsychologistProfile> =>
    reviveProfile(
      await apiFetch<SerializedPsychologistProfile>("/psychologists/me", {
        method: "PATCH",
        body: payload,
      }),
    ),
}
