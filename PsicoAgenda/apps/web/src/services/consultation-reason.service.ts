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
 * Error del campo de motivos, o null si se puede enviar. Se elige uno o varios;
 * con «Otro» el texto es obligatorio. `obligatorio` aplica a las altas nuevas.
 */
export function errorDeMotivo(
  elegidos: Pick<ConsultationReason, "label" | "requiresText">[],
  texto: string,
  obligatorio: boolean,
): string | null {
  if (elegidos.length === 0) return obligatorio ? "Elige al menos un motivo de consulta." : null
  const otro = elegidos.find((motivo) => motivo.requiresText)
  if (otro && !texto.trim()) return "Escribe el otro motivo de la consulta."
  return null
}
