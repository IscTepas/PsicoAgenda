"use client";

import { useQueries } from "@tanstack/react-query";
import { AppointmentRequestStatus } from "@psicoagenda/shared";
import {
  appointmentRequestService,
  appointmentService,
  notificationService,
  patientService,
} from "@/services";

const CLINICAL_STALE_TIME_MS = 30_000; // datos transaccionales
const CATALOG_STALE_TIME_MS = 2 * 60 * 1000; // catálogos

interface UseDashboardDataParams {
  from: Date;
  to: Date;
  includeTutored?: boolean;
}

/**
 * Agrupa las lecturas independientes del dashboard en una sola ráfaga controlada
 * por `useQueries`. Esto mantiene el paralelismo de datos pero centraliza los
 * tiempos de caché y evita que cada componente lance su propia petición.
 */
export function useDashboardData({ from, to, includeTutored }: UseDashboardDataParams) {
  const [appointments, patients, pendingRequests, notifications, tutored] = useQueries({
    queries: [
      {
        queryKey: ["appointments", "dashboard", from.toISOString(), to.toISOString()],
        queryFn: () => appointmentService.list({ from, to, limit: 200 }),
        staleTime: CLINICAL_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["patients", "list", 100],
        queryFn: () => patientService.list({ limit: 100 }),
        staleTime: CATALOG_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["appointment-requests", AppointmentRequestStatus.PENDING],
        queryFn: async () =>
          (await appointmentRequestService.list(AppointmentRequestStatus.PENDING)).filter(
            (r) => new Date(r.startTime).getTime() > Date.now(),
          ),
        staleTime: CLINICAL_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["notifications", "bell"],
        queryFn: () => notificationService.list(undefined, 20),
        staleTime: CLINICAL_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["pacientes", "tutelados"],
        queryFn: patientService.listTutored,
        staleTime: CATALOG_STALE_TIME_MS,
        refetchOnWindowFocus: false,
        enabled: includeTutored,
      },
    ],
  });

  return {
    appointments: appointments.data ?? [],
    isLoadingAppointments: appointments.isLoading,
    patients: patients.data ?? [],
    isLoadingPatients: patients.isLoading,
    pendingRequests: pendingRequests.data ?? [],
    isLoadingPendingRequests: pendingRequests.isLoading,
    notifications: notifications.data ?? [],
    isLoadingNotifications: notifications.isLoading,
    tutored: tutored.data ?? [],
    isLoadingTutored: tutored.isLoading,
    isLoading:
      appointments.isLoading ||
      patients.isLoading ||
      pendingRequests.isLoading ||
      notifications.isLoading ||
      (includeTutored && tutored.isLoading),
  };
}
