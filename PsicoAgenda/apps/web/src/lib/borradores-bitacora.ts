/**
 * Borradores de hojas de bitácora sin guardar. Viven en este navegador para que
 * cerrar la libreta (o la pestaña) no pierda lo escrito; se borran al guardar la
 * hoja y al cerrar sesión.
 *
 * shortcut: solo en este dispositivo, no se sincroniza; si se necesita seguir en otro equipo, guardar el borrador en la API.
 */
export interface BorradorDeHoja {
  clave: string
  patientId: string
  patientName?: string
  appointmentId?: string
  entryId?: string
  /** ISO: la fecha de la sesión. */
  sessionDate: string
  notes: string
  tasks: { id?: string; key: string; text: string }[]
  nueva: string
}

const PREFIJO = "bitacora-borrador:"
export const EVENTO_BORRADORES = "bitacora-borradores"

const avisar = () => window.dispatchEvent(new Event(EVENTO_BORRADORES))

export const claveDeBorrador = (patientId: string, appointmentId?: string, entryId?: string) =>
  `${PREFIJO}${appointmentId ?? entryId ?? `suelta-${patientId}`}`

export function leerBorrador(clave: string): BorradorDeHoja | null {
  try {
    const raw = window.localStorage.getItem(clave)
    return raw ? (JSON.parse(raw) as BorradorDeHoja) : null
  } catch {
    return null
  }
}

export function guardarBorrador(borrador: BorradorDeHoja) {
  try {
    window.localStorage.setItem(borrador.clave, JSON.stringify(borrador))
    avisar()
  } catch {
    // Sin almacenamiento (modo privado, cuota): la libreta sigue funcionando sin borrador.
  }
}

export function borrarBorrador(clave: string) {
  try {
    window.localStorage.removeItem(clave)
    avisar()
  } catch {}
}

export function listarBorradores(): BorradorDeHoja[] {
  try {
    return Object.keys(window.localStorage)
      .filter((clave) => clave.startsWith(PREFIJO))
      .flatMap((clave) => leerBorrador(clave) ?? [])
  } catch {
    return []
  }
}

/** Al cerrar sesión: las notas clínicas no se quedan en un equipo compartido. */
export function borrarTodosLosBorradores() {
  for (const borrador of listarBorradores()) borrarBorrador(borrador.clave)
}
