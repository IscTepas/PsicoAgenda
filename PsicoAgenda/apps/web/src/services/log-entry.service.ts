import type { SessionLogEntry } from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

interface SerializedLogEntry
  extends Omit<SessionLogEntry, "date" | "createdAt" | "updatedAt" | "tasks" | "closedAt"> {
  tasks?: { id: string; text: string; doneAt?: string }[]
  date: string
  createdAt: string
  updatedAt?: string
  closedAt?: string
}

function reviveLogEntry(raw: SerializedLogEntry): SessionLogEntry {
  return {
    ...raw,
    date: new Date(raw.date),
    tasks: (raw.tasks ?? []).map((t) => ({ ...t, doneAt: t.doneAt ? new Date(t.doneAt) : undefined })),
    closedAt: raw.closedAt ? new Date(raw.closedAt) : undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : undefined,
  }
}

export interface CreateLogEntryPayload {
  /** Evolución (por defecto), interconsulta/referencia o egreso. */
  kind?: "evolution" | "referral" | "discharge"
  appointmentId?: string
  sessionType?: string
  notes: string
  interventions?: string
  homework?: string
  /** Con `id` se conserva; sin `id` es nueva y se avisa al paciente. */
  tasks?: { id?: string; text: string }[]
  referredTo?: string
  referralReason?: string
  dischargeReason?: string
  dischargeSummary?: string
}

export type UpdateLogEntryPayload = Partial<Omit<CreateLogEntryPayload, "kind">>

export const logEntryService = {
  list: async (patientId: string, token?: string): Promise<SessionLogEntry[]> => {
    const rows = await apiFetch<SerializedLogEntry[]>(`/patients/${patientId}/log-entries`, {
      token,
    })
    return rows.map(reviveLogEntry)
  },

  create: async (patientId: string, payload: CreateLogEntryPayload): Promise<SessionLogEntry> =>
    reviveLogEntry(
      await apiFetch<SerializedLogEntry>(`/patients/${patientId}/log-entries`, {
        method: "POST",
        body: payload,
      }),
    ),

  /** Solo borradores: una nota cerrada ya no se modifica. */
  update: async (id: string, payload: UpdateLogEntryPayload): Promise<SessionLogEntry> =>
    reviveLogEntry(
      await apiFetch<SerializedLogEntry>(`/log-entries/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    ),

  /** Cierra (sella) la nota; pide la contraseña. */
  cerrar: async (id: string, password: string): Promise<SessionLogEntry> =>
    reviveLogEntry(
      await apiFetch<SerializedLogEntry>(`/log-entries/${id}/cerrar`, { method: "POST", body: { password } }),
    ),

  /** Nota aclaratoria sobre una nota cerrada; nace sellada. */
  aclarar: async (id: string, text: string, password: string): Promise<SessionLogEntry> =>
    reviveLogEntry(
      await apiFetch<SerializedLogEntry>(`/log-entries/${id}/aclaracion`, {
        method: "POST",
        body: { text, password },
      }),
    ),

  verificar: async (id: string): Promise<{ valid: boolean; hash?: string }> =>
    apiFetch<{ valid: boolean; hash?: string }>(`/log-entries/${id}/verificar`),
}
