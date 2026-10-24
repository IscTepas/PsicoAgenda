import type {
  Appointment,
  AppointmentModality,
  AppointmentRequest,
  AppointmentRequestStatus,
  AppointmentStatus,
  HonorariumPayment,
  PaymentStatus,
} from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

/**
 * La API serializa las fechas como cadenas ISO; el tipo compartido dice que son
 * `Date`. La interfaz hace `appointment.startTime.getHours()`, así que cada
 * respuesta se "revive" antes de salir de este módulo.
 */
interface SerializedPayment
  extends Omit<HonorariumPayment, "paidAt" | "createdAt" | "updatedAt"> {
  paidAt?: string
  createdAt: string
  updatedAt: string
}

interface SerializedAppointment
  extends Omit<Appointment, "startTime" | "createdAt" | "updatedAt" | "payment"> {
  startTime: string
  createdAt: string
  updatedAt: string
  payment?: SerializedPayment
}

function revivePayment(raw: SerializedPayment): HonorariumPayment {
  return {
    ...raw,
    paidAt: raw.paidAt ? new Date(raw.paidAt) : undefined,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
  }
}

function reviveAppointment(raw: SerializedAppointment): Appointment {
  return {
    ...raw,
    startTime: new Date(raw.startTime),
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    payment: raw.payment ? revivePayment(raw.payment) : undefined,
  }
}

export interface AppointmentListParams {
  from?: Date
  to?: Date
  patientId?: string
  psychologistId?: string
  status?: AppointmentStatus
  limit?: number
  offset?: number
  page?: number
}

export interface AppointmentOccupancySlot {
  startTime: Date
  endTime: Date
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
  if (params.limit !== undefined) search.set("limit", String(params.limit))
  if (params.offset !== undefined) search.set("offset", String(params.offset))
  if (params.page !== undefined) search.set("page", String(params.page))

  const query = search.toString()
  return query ? `?${query}` : ""
}

export const appointmentService = {
  list: async (params: AppointmentListParams = {}): Promise<Appointment[]> => {
    const rows = await apiFetch<SerializedAppointment[]>(`/appointments${buildQuery(params)}`)
    return rows.map(reviveAppointment)
  },

  /** Solo los rangos ocupados (sin datos del paciente) para el calendario. */
  getOccupancy: async (params: { from: Date; to: Date }): Promise<AppointmentOccupancySlot[]> => {
    const rows = await apiFetch<{ startTime: string; endTime: string }[]>(
      `/appointments/occupancy${buildQuery(params)}`,
    )
    return rows.map((row) => ({
      startTime: new Date(row.startTime),
      endTime: new Date(row.endTime),
    }))
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

  updatePayment: async (id: string, status: PaymentStatus): Promise<Appointment> =>
    reviveAppointment(
      await apiFetch<SerializedAppointment>(`/appointments/${id}/payment`, {
        method: "PATCH",
        body: { status },
      }),
    ),
}

interface SerializedAppointmentRequest
  extends Omit<AppointmentRequest, "startTime" | "createdAt" | "handledAt"> {
  startTime: string
  createdAt: string
  handledAt?: string
}

function reviveAppointmentRequest(raw: SerializedAppointmentRequest): AppointmentRequest {
  return {
    ...raw,
    startTime: new Date(raw.startTime),
    createdAt: new Date(raw.createdAt),
    handledAt: raw.handledAt ? new Date(raw.handledAt) : undefined,
  }
}

export interface CreateAppointmentRequestPayload {
  startTime: Date
  durationMinutes: number
  modality: AppointmentModality
  reason?: string
}

export interface RescheduleAppointmentRequestPayload extends CreateAppointmentRequestPayload {
  appointmentId: string
}

/** Solicitudes del paciente: no ocupan agenda hasta que el psicólogo las acepta. */
export const appointmentRequestService = {
  list: async (status?: AppointmentRequestStatus): Promise<AppointmentRequest[]> => {
    const rows = await apiFetch<SerializedAppointmentRequest[]>(
      `/appointment-requests${status ? `?status=${status}` : ""}`,
    )
    return rows.map(reviveAppointmentRequest)
  },

  create: async (payload: CreateAppointmentRequestPayload): Promise<AppointmentRequest> =>
    reviveAppointmentRequest(
      await apiFetch<SerializedAppointmentRequest>("/appointment-requests", {
        method: "POST",
        body: { ...payload, startTime: payload.startTime.toISOString() },
      }),
    ),

  /** Cancela la cita actual y pide el nuevo horario en una sola operación. */
  reschedule: async (payload: RescheduleAppointmentRequestPayload): Promise<AppointmentRequest> =>
    reviveAppointmentRequest(
      await apiFetch<SerializedAppointmentRequest>("/appointment-requests/reschedule", {
        method: "POST",
        body: { ...payload, startTime: payload.startTime.toISOString() },
      }),
    ),

  /** Devuelve la cita creada (ya confirmada). */
  accept: async (id: string): Promise<Appointment> =>
    reviveAppointment(
      await apiFetch<SerializedAppointment>(`/appointment-requests/${id}/accept`, { method: "POST" }),
    ),

  reject: async (id: string): Promise<AppointmentRequest> =>
    reviveAppointmentRequest(
      await apiFetch<SerializedAppointmentRequest>(`/appointment-requests/${id}/reject`, { method: "POST" }),
    ),

  cancel: async (id: string): Promise<AppointmentRequest> =>
    reviveAppointmentRequest(
      await apiFetch<SerializedAppointmentRequest>(`/appointment-requests/${id}/cancel`, { method: "POST" }),
    ),
}
