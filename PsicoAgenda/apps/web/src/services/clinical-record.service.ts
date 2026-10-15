import type { ClinicalRecord } from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

interface SerializedClinicalRecord extends Omit<ClinicalRecord, "openedAt" | "updatedAt"> {
  openedAt: string
  updatedAt: string
}

function reviveClinicalRecord(raw: SerializedClinicalRecord): ClinicalRecord {
  return {
    ...raw,
    openedAt: new Date(raw.openedAt),
    updatedAt: new Date(raw.updatedAt),
  }
}

export const clinicalRecordService = {
  get: async (patientId: string, token?: string): Promise<ClinicalRecord> =>
    reviveClinicalRecord(
      await apiFetch<SerializedClinicalRecord>(`/patients/${patientId}/clinical-record`, {
        token,
      }),
    ),
}
