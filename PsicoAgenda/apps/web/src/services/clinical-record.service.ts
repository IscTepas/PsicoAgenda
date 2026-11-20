import type { AuditEntry, ClinicalRecord, InformedConsent, LegalGuardian, MentalExam } from "@psicoagenda/shared"
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
  extends Omit<ClinicalRecord, "openedAt" | "updatedAt" | "consents" | "historyClosedAt" | "retainUntil"> {
  openedAt: string
  updatedAt: string
  historyClosedAt?: string
  retainUntil?: string
  consents?: SerializedConsent[]
}

const fechaOpcional = (v?: string) => (v ? new Date(v) : undefined)

function reviveClinicalRecord(raw: SerializedClinicalRecord): ClinicalRecord {
  return {
    ...raw,
    openedAt: new Date(raw.openedAt),
    updatedAt: new Date(raw.updatedAt),
    historyClosedAt: fechaOpcional(raw.historyClosedAt),
    retainUntil: fechaOpcional(raw.retainUntil),
    consents: (raw.consents ?? []).map((consent) => ({
      ...consent,
      signedAt: new Date(consent.signedAt),
      withdrawnAt: fechaOpcional(consent.withdrawnAt),
      createdAt: new Date(consent.createdAt),
      legalGuardian: consent.legalGuardian
        ? { ...consent.legalGuardian, createdAt: new Date(consent.legalGuardian.createdAt) }
        : undefined,
    })),
  }
}

/** Campos de la historia clínica y del expediente que escribe la psicóloga. */
export interface ClinicalRecordPayload {
  chiefComplaint?: string
  currentProblem?: string
  familyHistory?: string
  nonPathologicalHistory?: string
  pathologicalHistory?: string
  mentalExam?: MentalExam
  psychometricTests?: string
  diagnosis?: string
  diagnosisCode?: string
  diagnosisSystem?: "CIE-10" | "CIE-11"
  prognosis?: string
  treatmentPlan?: string
  generalObservations?: string
}

export interface ConsentPayload {
  signedAt: string
  document: string
  guardianId?: string
  /** Firma dibujada en pantalla (data URL PNG). */
  signatureImage?: string
  /** PDF firmado, en base64. */
  pdfBase64?: string
  privacyNoticeAccepted: true
}

const enExpediente = (patientId: string, ruta = "") =>
  `/patients/${patientId}/clinical-record${ruta}`

export const clinicalRecordService = {
  update: async (patientId: string, payload: ClinicalRecordPayload): Promise<ClinicalRecord> =>
    reviveClinicalRecord(
      await apiFetch<SerializedClinicalRecord>(enExpediente(patientId), { method: "PATCH", body: payload }),
    ),

  /** Cierra (sella) la historia clínica; pide la contraseña. */
  cerrarHistoria: async (patientId: string, password: string): Promise<ClinicalRecord> =>
    reviveClinicalRecord(
      await apiFetch<SerializedClinicalRecord>(enExpediente(patientId, "/cerrar"), {
        method: "POST",
        body: { password },
      }),
    ),

  registrarConsentimiento: async (patientId: string, payload: ConsentPayload): Promise<ClinicalRecord> =>
    reviveClinicalRecord(
      await apiFetch<SerializedClinicalRecord>(`/patients/${patientId}/consents`, { method: "POST", body: payload }),
    ),

  retirarConsentimiento: async (patientId: string, consentId: string): Promise<ClinicalRecord> =>
    reviveClinicalRecord(
      await apiFetch<SerializedClinicalRecord>(`/patients/${patientId}/consents/${consentId}/withdraw`, {
        method: "POST",
      }),
    ),

  /** Enlace temporal (5 min) al PDF firmado del consentimiento. */
  enlacePdf: async (patientId: string, consentId: string): Promise<string> =>
    (await apiFetch<{ url: string }>(`/patients/${patientId}/consents/${consentId}/pdf`)).url,

  /** Baja lógica del paciente: deja de listarse y su expediente se conserva 5 años. */
  darDeBaja: async (patientId: string): Promise<ClinicalRecord> =>
    reviveClinicalRecord(
      await apiFetch<SerializedClinicalRecord>(`/patients/${patientId}/baja`, { method: "POST" }),
    ),

  /** Deja constancia de la impresión del expediente. */
  registrarImpresion: async (patientId: string): Promise<void> => {
    await apiFetch<void>(enExpediente(patientId, "/impresion"), { method: "POST" })
  },

  auditoria: async (patientId: string): Promise<AuditEntry[]> =>
    (await apiFetch<(Omit<AuditEntry, "createdAt"> & { createdAt: string })[]>(`/patients/${patientId}/audit`)).map(
      (a) => ({ ...a, createdAt: new Date(a.createdAt) }),
    ),

  get: async (patientId: string, token?: string): Promise<ClinicalRecord> =>
    reviveClinicalRecord(await apiFetch<SerializedClinicalRecord>(enExpediente(patientId), { token })),
}
