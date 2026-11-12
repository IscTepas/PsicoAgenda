import { AppointmentStatus, CAMBIO_DE_FECHA_PREFIJO, type Appointment } from "@psicoagenda/shared"

/** Motivos predefinidos al cancelar o cambiar la fecha de una cita; «Otro» se escribe. */
export const MOTIVOS_DE_CAMBIO = [
  "Inconveniente de horario o imprevisto",
  "Motivos de salud física",
  "Compromiso laboral o escolar",
  "Problema de transporte",
  "Motivo económico",
]

export interface ConteoDeMotivo {
  motivo: string
  veces: number
}

/**
 * Motivos más usados en las citas canceladas del período, separando las que se
 * cancelaron de las que el paciente movió a otra fecha (su cita original queda
 * cancelada con el prefijo de cambio).
 */
export function resumenDeMotivos(
  citas: Pick<Appointment, "status" | "cancellationReason">[],
): { cancelaciones: ConteoDeMotivo[]; cambios: ConteoDeMotivo[] } {
  const contar = (motivos: string[]): ConteoDeMotivo[] => {
    const veces = new Map<string, number>()
    for (const motivo of motivos) veces.set(motivo, (veces.get(motivo) ?? 0) + 1)
    return [...veces].map(([motivo, n]) => ({ motivo, veces: n })).sort((a, b) => b.veces - a.veces)
  }
  const motivos = citas
    .filter((cita) => cita.status === AppointmentStatus.CANCELLED)
    .map((cita) => cita.cancellationReason?.trim() || "Sin motivo registrado")
  const esCambio = (motivo: string) => motivo.startsWith(CAMBIO_DE_FECHA_PREFIJO.trim())
  return {
    cancelaciones: contar(motivos.filter((m) => !esCambio(m))),
    cambios: contar(
      motivos.filter(esCambio).map((m) => m.slice(CAMBIO_DE_FECHA_PREFIJO.trim().length).trim() || "Sin motivo registrado"),
    ),
  }
}
