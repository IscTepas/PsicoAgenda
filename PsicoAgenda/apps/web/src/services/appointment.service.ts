import type { Appointment, AppointmentModality, AppointmentStatus } from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

/**
 * La API serializa las fechas como cadenas ISO; el tipo compartido dice que son
 * `Date`. La interfaz hace `appointment.startTime.getHours()`, así que cada
 * respuesta se "revive" antes de salir de este módulo.
 */
interface SerializedAppointment
  extends Omit<Appointment, "startTime" | "createdAt" | "updatedAt"> {
  startTime: string
  createdAt: string
  updatedAt: string
}

function reviveAppointment(raw: SerializedAppointment): Appointment {
  return {
    ...raw,
    startTime: new Date(raw.startTime),
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  }
}

export interface AppointmentListParams {
  from?: Date
  to?: Date
  patientId?: string
  psychologistId?: string
  status?: AppointmentStatus
}

export interface CreateAppointmentPayload {
  patientId: string
  startTime: Date
  durationMinutes: number
  modality: AppointmentModality
  reason?: string
}

export interface UpdateAppointmentPayload {
  startTime?: Date
  durationMinutes?: number
  modality?: AppointmentModality
  reason?: string
  notes?: string
}

function buildQuery(params: AppointmentListParams): string {
  const search = new URLSearchParams()

  if (params.from) search.set("from", params.from.toISOString())
  if (params.to) search.set("to", params.to.toISOString())
  if (params.patientId) search.set("patientId", params.patientId)
  if (params.psychologistId) search.set("psychologistId", params.psychologistId)
  if (params.status) search.set("status", params.status)

  const query = search.toString()
  return query ? `?${query}` : ""
}

export const appointmentService = {
  list: async (params: AppointmentListParams = {}): Promise<Appointment[]> => {
    const rows = await apiFetch<SerializedAppointment[]>(`/appointments${buildQuery(params)}`)
    return rows.map(reviveAppointment)
  },

  get: async (id: string, token?: string): Promise<Appointment> =>
    reviveAppointment(await apiFetch<SerializedAppointment>(`/appointments/${id}`, { token })),

  create: async (payload: CreateAppointmentPayload): Promise<Appointment> =>
    reviveAppointment(
      await apiFetch<SerializedAppointment>("/appointments", {
        method: "POST",
        body: {
          ...payload,
          startTime: payload.startTime.toISOString(),
        },
      }),
    ),

  update: async (id: string, payload: UpdateAppointmentPayload): Promise<Appointment> =>
    reviveAppointment(
      await apiFetch<SerializedAppointment>(`/appointments/${id}`, {
        method: "PATCH",
        body: {
          ...payload,
          ...(payload.startTime ? { startTime: payload.startTime.toISOString() } : {}),
        },
      }),
    ),

  changeStatus: async (id: string, status: AppointmentStatus): Promise<Appointment> =>
    reviveAppointment(
      await apiFetch<SerializedAppointment>(`/appointments/${id}/status`, {
        method: "PATCH",
        body: { status },
      }),
    ),

  cancel: async (id: string, reason: string): Promise<Appointment> =>
    reviveAppointment(
      await apiFetch<SerializedAppointment>(`/appointments/${id}/cancel`, {
        method: "POST",
        body: { reason },
      }),
    ),
}
