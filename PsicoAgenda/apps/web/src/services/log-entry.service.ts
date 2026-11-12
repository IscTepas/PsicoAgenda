import type { SessionLogEntry } from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

interface SerializedLogEntry
  extends Omit<SessionLogEntry, "date" | "createdAt" | "updatedAt" | "tasks"> {
  tasks?: { id: string; text: string; doneAt?: string }[]
  date: string
  createdAt: string
  updatedAt?: string
}

function reviveLogEntry(raw: SerializedLogEntry): SessionLogEntry {
  return {
    ...raw,
    date: new Date(raw.date),
    tasks: (raw.tasks ?? []).map((t) => ({ ...t, doneAt: t.doneAt ? new Date(t.doneAt) : undefined })),
    createdAt: new Date(raw.createdAt),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : undefined,
  }
}

export interface CreateLogEntryPayload {
  appointmentId?: string
  sessionType?: string
  notes: string
  interventions?: string
  homework?: string
  /** Con `id` se conserva; sin `id` es nueva y se avisa al paciente. */
  tasks?: { id?: string; text: string }[]
}

export interface UpdateLogEntryPayload {
  appointmentId?: string
  sessionType?: string
  notes?: string
  interventions?: string
  homework?: string
  /** Con `id` se conserva; sin `id` es nueva y se avisa al paciente. */
  tasks?: { id?: string; text: string }[]
}

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

  update: async (id: string, payload: UpdateLogEntryPayload): Promise<SessionLogEntry> =>
    reviveLogEntry(
      await apiFetch<SerializedLogEntry>(`/log-entries/${id}`, {
        method: "PATCH",
        body: payload,
      }),
    ),
}
