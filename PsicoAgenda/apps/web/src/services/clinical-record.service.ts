import type { ClinicalRecord, InformedConsent, LegalGuardian } from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

interface SerializedGuardian extends Omit<LegalGuardian, "createdAt"> {
  createdAt: string
}

interface SerializedConsent
  extends Omit<InformedConsent, "signedAt" | "withdrawnAt" | "createdAt" | "legalGuardian"> {
  signedAt: string
  withdrawnAt?: string
  createdAt: string
  legalGuardian?: SerializedGuardian
}

interface SerializedClinicalRecord
  extends Omit<ClinicalRecord, "openedAt" | "updatedAt" | "consents"> {
  openedAt: string
  updatedAt: string
  consents?: SerializedConsent[]
}

function reviveClinicalRecord(raw: SerializedClinicalRecord): ClinicalRecord {
  return {
    ...raw,
    openedAt: new Date(raw.openedAt),
    updatedAt: new Date(raw.updatedAt),
    consents: (raw.consents ?? []).map((consent) => ({
      ...consent,
      signedAt: new Date(consent.signedAt),
      withdrawnAt: consent.withdrawnAt ? new Date(consent.withdrawnAt) : undefined,
      createdAt: new Date(consent.createdAt),
      legalGuardian: consent.legalGuardian
        ? { ...consent.legalGuardian, createdAt: new Date(consent.legalGuardian.createdAt) }
        : undefined,
    })),
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
