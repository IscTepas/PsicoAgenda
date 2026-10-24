/**
 * Utilidades del calendario multimes. Se apoyan en los helpers de `lib/citas`
 * (fechas locales, sin librerías externas) y se mantienen puras para poder
 * probarlas sin DOM.
 */
import {
  filtrarHorasDisponibles,
  formatDateToInput,
  startOfDay,
} from "@/lib/citas";

export const DIAS_SEMANA = ["D", "L", "M", "M", "J", "V", "S"] as const;

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Suma meses sobre el día 1 para no caer en el desbordamiento de fin de mes. */
export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function monthLabel(date: Date): string {
  const text = date.toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Cuadrícula de 6 semanas empezando en domingo; incluye días vecinos. */
export function monthGridSunday(month: Date): Date[] {
  const first = startOfMonth(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export type EstadoDia =
  | "available"
  | "partial"
  | "full"
  | "no-schedule"
  | "disabled";

/**
 * Estado visual de un día:
 * - `partial`: tiene citas pero aún quedan franjas libres (azul).
 * - `full`: ya no queda ninguna franja libre (ámbar).
 * - `no-schedule`: el profesional no atiende ese día.
 * - `disabled`: pasado o anterior al mínimo permitido.
 */
export function calcularEstadoDia({
  fecha,
  hoy,
  minima,
  maxima,
  horasDelDia,
  horasOcupadas,
  ahora,
}: {
  fecha: Date;
  hoy: Date | null;
  minima: Date | null;
  maxima: Date | null;
  horasDelDia: string[];
  horasOcupadas: ReadonlySet<string>;
  ahora: Date;
}): EstadoDia {
  const dia = startOfDay(fecha).getTime();

  if (hoy && dia < startOfDay(hoy).getTime()) return "disabled";
  if (minima && dia < startOfDay(minima).getTime()) return "disabled";
  if (maxima && dia > startOfDay(maxima).getTime()) return "disabled";
  if (horasDelDia.length === 0) return "no-schedule";

  const vigentes = filtrarHorasDisponibles(horasDelDia, fecha, ahora);
  if (vigentes.length === 0) return "full";

  const libres = vigentes.filter((hora) => !horasOcupadas.has(hora));
  if (libres.length === 0) return "full";
  if (libres.length < vigentes.length) return "partial";

  return "available";
}

/**
 * Agrupa las citas ocupadas por día y hora de inicio (`HH:00`), que es como el
 * formulario compara las franjas del horario.
 */
export function agruparOcupacionPorDia(
  slots: { startTime: Date }[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const slot of slots) {
    const key = formatDateToInput(slot.startTime);
    const hour = `${String(slot.startTime.getHours()).padStart(2, "0")}:00`;
    const hours = map.get(key) ?? new Set<string>();
    hours.add(hour);
    map.set(key, hours);
  }

  return map;
}
