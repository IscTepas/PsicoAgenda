"use client"

import { useQuery } from "@tanstack/react-query"
import { AppointmentRequestStatus, AppointmentStatus } from "@psicoagenda/shared"
import { appointmentRequestService, appointmentService } from "@/services"

const MINUTE = 60_000
// La barra y la campana lo consultan en todas las pantallas: cada 2 min basta
// (al volver a la pestaña se refresca de inmediato).
const POLL = 2 * MINUTE

/** Claves compartidas: la bandeja, la campana y la barra leen la misma caché. */
export const PENDING_REQUESTS_KEY = ["appointment-requests", AppointmentRequestStatus.PENDING] as const
export const PENDING_APPOINTMENTS_KEY = ["appointments", "pending"] as const

const startOfToday = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/**
 * Lo que espera respuesta de la psicóloga: solicitudes de pacientes (solo las de
 * fechas por venir) y citas sin confirmar de hoy en adelante. Se refresca al
 * volver a la pestaña y cada 2 minutos, porque otra persona puede responder antes.
 */
export function usePendingResponses(enabled: boolean) {
  const requests = useQuery({
    queryKey: PENDING_REQUESTS_KEY,
    queryFn: async () =>
      (await appointmentRequestService.list(AppointmentRequestStatus.PENDING))
        .filter((request) => new Date(request.startTime).getTime() > Date.now())
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    enabled,
    staleTime: 30_000,
    refetchInterval: POLL,
    refetchOnWindowFocus: true,
  })

  const appointments = useQuery({
    queryKey: PENDING_APPOINTMENTS_KEY,
    queryFn: () => appointmentService.list({ from: startOfToday(), status: AppointmentStatus.PENDING, limit: 200 }),
    enabled,
    staleTime: 30_000,
    refetchInterval: POLL,
    refetchOnWindowFocus: true,
  })

  const pendingRequests = requests.data ?? []
  const pendingAppointments = appointments.data ?? []

  return {
    pendingRequests,
    pendingAppointments,
    count: pendingRequests.length + pendingAppointments.length,
    isLoading: requests.isLoading || appointments.isLoading,
    isError: requests.isError || appointments.isError,
    isFetched: requests.isFetched && appointments.isFetched,
    refetch: () => Promise.all([requests.refetch(), appointments.refetch()]),
  }
}
