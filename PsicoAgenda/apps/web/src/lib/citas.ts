/**
 * Reglas de fecha y disponibilidad para agendar citas. Se mantienen puras (con
 * `ahora` inyectable) para poder probarlas sin depender del reloj real.
 */

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDateToInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseInputToDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 9, 0, 0, 0);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

/** Mañana a las 00:00: el mínimo para que un paciente solicite una cita. */
export function fechaMinimaSolicitud(ahora: Date): Date {
  return addDays(startOfDay(ahora), 1);
}

/**
 * Fecha mínima según el flujo: los pacientes solicitan desde mañana; el
 * psicólogo puede agendar hoy; la edición conserva la fecha de la cita.
 */
export function fechaMinimaPara({
  esPaciente,
  esEdicion,
  ahora,
}: {
  esPaciente: boolean;
  esEdicion: boolean;
  ahora: Date;
}): Date | null {
  if (esEdicion) return null;
  return esPaciente ? fechaMinimaSolicitud(ahora) : startOfDay(ahora);
}

/**
 * Oculta las franjas que ya empezaron cuando la fecha es hoy. `horaExenta`
 * mantiene visible la hora de la cita que se está editando.
 */
export function filtrarHorasDisponibles(
  horas: string[],
  fecha: Date,
  ahora: Date,
  horaExenta?: string,
): string[] {
  if (!isSameDay(fecha, ahora)) return horas;

  return horas.filter((hora) => {
    if (hora === horaExenta) return true;
    const [h, m] = hora.split(":").map(Number);
    const inicio = new Date(fecha);
    inicio.setHours(h, m, 0, 0);
    return inicio.getTime() > ahora.getTime();
  });
}

export type EstadoFecha =
  | "sin-fecha"
  | "consultando"
  | "no-permitida"
  | "sin-horario"
  | "lleno"
  | "disponible";

/**
 * Estado que pinta el preview de la fecha:
 * - `sin-horario`: el día no tiene franjas en el horario del profesional.
 * - `lleno`: tiene franjas, pero ninguna queda libre (ocupadas o ya pasadas).
 * - `disponible`: al menos una franja se puede elegir.
 */
export function calcularEstadoFecha({
  fecha,
  horasDelDia,
  horasDisponibles,
  horasOcupadas,
  cargando,
  minima,
}: {
  fecha: Date | null;
  horasDelDia: string[];
  horasDisponibles: string[];
  horasOcupadas: ReadonlySet<string>;
  cargando: boolean;
  minima: Date | null;
}): EstadoFecha {
  if (!fecha) return "sin-fecha";
  if (cargando) return "consultando";

  if (minima && startOfDay(fecha).getTime() < startOfDay(minima).getTime()) {
    return "no-permitida";
  }
  if (horasDelDia.length === 0) return "sin-horario";
  if (horasDisponibles.length === 0) return "lleno";
  if (horasDisponibles.every((hora) => horasOcupadas.has(hora))) return "lleno";

  return "disponible";
}
