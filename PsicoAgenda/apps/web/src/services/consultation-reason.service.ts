import type { ConsultationReason, ConsultationReasonGroup } from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

type ReasonDraft = Pick<ConsultationReason, "label" | "category"> &
  Partial<Pick<ConsultationReason, "order" | "isOther" | "requiresText" | "active">>

export const consultationReasonService = {
  /** Motivos activos agrupados por categoría (selectores de cita y solicitud). */
  listActive: () => apiFetch<ConsultationReasonGroup[]>("/motivos-consulta"),
  /** Administración: todos, incluidos los inactivos. */
  listAll: () => apiFetch<ConsultationReason[]>("/motivos-consulta/todos"),
  create: (input: ReasonDraft & { code: string }) =>
    apiFetch<ConsultationReason>("/motivos-consulta", { method: "POST", body: input }),
  update: (id: string, input: Partial<ReasonDraft>) =>
    apiFetch<ConsultationReason>(`/motivos-consulta/${id}`, { method: "PATCH", body: input }),
  remove: (id: string) => apiFetch<void>(`/motivos-consulta/${id}`, { method: "DELETE" }),
}

/**
 * Error del campo de motivo, o null si se puede enviar. «Otro» (y cualquier motivo
 * que pida texto) no se envía vacío; `obligatorio` aplica a las altas nuevas.
 */
export function errorDeMotivo(
  motivo: Pick<ConsultationReason, "label" | "requiresText"> | undefined,
  texto: string,
  obligatorio: boolean,
): string | null {
  if (!motivo) return obligatorio ? "Elige el motivo de la consulta." : null
  if (motivo.requiresText && !texto.trim()) return `Describe el motivo para «${motivo.label}».`
  return null
}
