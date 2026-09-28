"use client";

import { useQuery } from "@tanstack/react-query";
import { healthService } from "@/services";

export interface HealthState {
  isOnline: boolean | undefined;
  detail: string | undefined;
}

/** Consulta el estado de la API para distinguir "sin red" de "API caída". */
export function useApiHealth(): HealthState {
  const { data, isError, isPending } = useQuery({
    queryKey: ["api", "health"],
    queryFn: healthService.check,
    refetchInterval: 60_000,
    retry: false,
  });

  if (isPending) return { isOnline: undefined, detail: undefined };
  if (isError) return { isOnline: false, detail: "API no disponible" };

  return { isOnline: data.status === "ok", detail: data.service };
}
