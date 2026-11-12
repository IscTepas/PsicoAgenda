"use client";

import { useQueries } from "@tanstack/react-query";
import { appointmentService, patientService } from "@/services";

const CLINICAL_STALE_TIME_MS = 30_000;
const CATALOG_STALE_TIME_MS = 2 * 60 * 1000;

interface UseReportsDataParams {
  fromDate: string;
  toDate: string;
}

/**
 * Agrupa las lecturas de reportes —citas del período y nombres de pacientes—
 * en una sola ráfaga controlada por `useQueries`.
 */
export function useReportsData({ fromDate, toDate }: UseReportsDataParams) {
  const [appointments, patients] = useQueries({
    queries: [
      {
        queryKey: ["reports", "appointments", fromDate, toDate],
        queryFn: () =>
          appointmentService.list({
            from: new Date(`${fromDate}T00:00:00`),
            to: new Date(`${toDate}T23:59:59.999`),
            limit: 200,
          }),
        staleTime: CLINICAL_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
      {
        queryKey: ["patients", "list", 100],
        queryFn: () => patientService.list({ limit: 100 }),
        staleTime: CATALOG_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
    ],
  });

  return {
    appointments: appointments.data ?? [],
    isFetching: appointments.isFetching,
    isLoading: appointments.isLoading || patients.isLoading,
    patients: patients.data ?? [],
  };
}
