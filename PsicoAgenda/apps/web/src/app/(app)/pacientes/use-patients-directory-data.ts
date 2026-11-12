"use client";

import { useQueries } from "@tanstack/react-query";
import { appointmentService, patientService } from "@/services";

const CLINICAL_STALE_TIME_MS = 30_000;
const CATALOG_STALE_TIME_MS = 2 * 60 * 1000;

/**
 * Combina las dos lecturas del directorio de pacientes —pacientes y citas
 * recientes— en una sola ráfaga controlada por `useQueries`.
 */
export function usePatientsDirectoryData() {
  const [patients, appointments] = useQueries({
    queries: [
      {
        queryKey: ["patients", "directory", 100],
        queryFn: () => patientService.list({ limit: 100 }),
        staleTime: CATALOG_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["appointments", "patients-enrich", "90d"],
        queryFn: () => {
          const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
          return appointmentService.list({ from, limit: 200 });
        },
        staleTime: CLINICAL_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
    ],
  });

  return {
    patients: patients.data ?? [],
    appointments: appointments.data ?? [],
    isLoading: patients.isLoading || appointments.isLoading,
    error: patients.error || appointments.error,
  };
}
