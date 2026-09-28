import { apiFetch, type ApiError } from "@/lib/api-client";

export interface HealthStatus {
  status: string;
  service: string;
  timestamp: string;
}

export const healthService = {
  /** Comprobación de disponibilidad de la API. */
  check: () => apiFetch<HealthStatus>("/health"),
};

export { ApiError };
