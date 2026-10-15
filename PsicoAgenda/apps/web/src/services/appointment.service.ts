import {
  AppointmentStatus,
  type Appointment,
  type AppointmentModality,
} from "@psicoagenda/shared";
import { apiFetch } from "@/lib/api-client";

export interface CreateAppointmentPayload {
  patientId: string;
  startTime: Date;
  durationMinutes: number;
  modality: AppointmentModality;
  reason?: string;
  psychologistId?: string;
}

export interface UpdateAppointmentPayload {
  startTime?: Date;
  durationMinutes?: number;
  modality?: AppointmentModality;
  reason?: string;
  notes?: string;
}

export interface AppointmentListFilter {
  from?: Date;
  to?: Date;
  status?: AppointmentStatus;
  patientId?: string;
  psychologistId?: string;
}

function toQueryString(filter: AppointmentListFilter): string {
  const params = new URLSearchParams();
  if (filter.from) params.set("from", filter.from.toISOString());
  if (filter.to) params.set("to", filter.to.toISOString());
  if (filter.status) params.set("status", filter.status);
  if (filter.patientId) params.set("patientId", filter.patientId);
  if (filter.psychologistId)
    params.set("psychologistId", filter.psychologistId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export const appointmentService = {
  list: (filter: AppointmentListFilter = {}) =>
    apiFetch<Appointment[]>(`/appointments${toQueryString(filter)}`),

  getById: (id: string) => apiFetch<Appointment>(`/appointments/${id}`),

  create: (payload: CreateAppointmentPayload) =>
    apiFetch<Appointment>("/appointments", {
      method: "POST",
      body: payload,
    }),

  update: (id: string, payload: UpdateAppointmentPayload) =>
    apiFetch<Appointment>(`/appointments/${id}`, {
      method: "PATCH",
      body: payload,
    }),

  updateStatus: (id: string, status: AppointmentStatus) =>
    apiFetch<Appointment>(`/appointments/${id}/status`, {
      method: "PATCH",
      body: { status },
    }),

  cancel: (id: string, reason: string) =>
    apiFetch<Appointment>(`/appointments/${id}/cancel`, {
      method: "POST",
      body: { reason },
    }),
};
