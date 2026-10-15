import type { Patient } from "@psicoagenda/shared";
import { apiFetch } from "@/lib/api-client";

export const patientService = {
  list: () => apiFetch<Patient[]>("/patients"),
  getById: (id: string) => apiFetch<Patient>(`/patients/${id}`),
};
