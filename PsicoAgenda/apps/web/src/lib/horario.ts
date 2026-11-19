import { SCHEDULE_FIRST_HOUR, SCHEDULE_LAST_HOUR, type PsychologistScheduleSlot } from "@psicoagenda/shared"
import type { DayKey, WeekAvailability } from "@/components/motion/availability-scheduler/types"

/** Lunes = 1 … domingo = 7, en el orden del componente. */
export const DIAS: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`

/** Franjas de una hora (lo que guarda la API) → rangos continuos por día (lo que edita el componente). */
export function semanaDesdeFranjas(slots: PsychologistScheduleSlot[]): WeekAvailability {
  const semana = {} as WeekAvailability
  DIAS.forEach((dia, i) => {
    const horas = slots
      .filter((s) => s.dayOfWeek === i + 1)
      .map((s) => Number(s.startTime.slice(0, 2)))
      .sort((a, b) => a - b)
    const ranges: WeekAvailability[DayKey]["ranges"] = []
    for (const h of horas) {
      const ultimo = ranges[ranges.length - 1]
      if (ultimo && ultimo.end === hh(h)) ultimo.end = hh(h + 1)
      else ranges.push({ id: `${dia}-${h}`, start: hh(h), end: hh(h + 1) })
    }
    semana[dia] = { enabled: ranges.length > 0, ranges: ranges.length > 0 ? ranges : [{ id: `${dia}-0`, start: "09:00", end: "14:00" }] }
  })
  return semana
}

const NOMBRES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
const corta = (v: string) => v.replace(/^0/, "")

/**
 * Problemas del horario mientras se edita (sin esperar a guardar): horarios del
 * mismo día que se enciman o que terminan antes de empezar. `null` si está bien.
 */
export function problemaDeSemana(semana: WeekAvailability): string | null {
  for (const [i, dia] of DIAS.entries()) {
    const d = semana[dia]
    if (!d?.enabled) continue
    const rangos = [...d.ranges].sort((a, b) => a.start.localeCompare(b.start))
    for (const r of rangos) {
      if (r.end <= r.start) return `El ${NOMBRES[i]}: ${corta(r.start)} a ${corta(r.end)} termina antes de empezar.`
    }
    for (let k = 1; k < rangos.length; k++) {
      const antes = rangos[k - 1]
      const este = rangos[k]
      // Pegados (13:00–15:00 y 15:00–19:00) está bien; encimados no.
      if (este.start < antes.end) {
        return `El ${NOMBRES[i]} tiene horarios encimados: ${corta(antes.start)}–${corta(antes.end)} y ${corta(este.start)}–${corta(este.end)}. Deja un hueco o únelos (por ejemplo, 9:00–13:00 y 15:00–19:00).`
      }
    }
  }
  return null
}

/**
 * Rangos del componente → franjas de una hora para la API. Devuelve un error legible
 * si algo queda fuera del horario permitido (las sesiones empiezan entre 7:00 y 21:00).
 */
export function franjasDesdeSemana(semana: WeekAvailability): { franjas: { dayOfWeek: number; hour: number }[]; error?: string } {
  const encimados = problemaDeSemana(semana)
  if (encimados) return { franjas: [], error: encimados }
  const franjas = new Map<string, { dayOfWeek: number; hour: number }>()
  for (const [i, dia] of DIAS.entries()) {
    const d = semana[dia]
    if (!d?.enabled) continue
    for (const r of d.ranges) {
      const desde = Number(r.start.slice(0, 2)) + Number(r.start.slice(3, 5)) / 60
      const hasta = Number(r.end.slice(0, 2)) + Number(r.end.slice(3, 5)) / 60
      if (hasta <= desde) return { franjas: [], error: "Cada horario debe terminar después de empezar." }
      if (desde < SCHEDULE_FIRST_HOUR || hasta > SCHEDULE_LAST_HOUR + 1) {
        return {
          franjas: [],
          error: `Las sesiones se dan entre ${SCHEDULE_FIRST_HOUR}:00 y ${SCHEDULE_LAST_HOUR + 1}:00.`,
        }
      }
      for (let h = Math.ceil(desde); h + 1 <= hasta; h++) franjas.set(`${i + 1}-${h}`, { dayOfWeek: i + 1, hour: h })
    }
  }
  if (franjas.size === 0) return { franjas: [], error: "Deja al menos un horario en la semana." }
  return { franjas: [...franjas.values()] }
}
