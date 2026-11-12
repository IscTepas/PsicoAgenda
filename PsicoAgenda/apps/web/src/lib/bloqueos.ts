export interface Tramo {
  startTime: string
  endTime: string
}

/**
 * Une franjas "HH:mm" seguidas en tramos: 09–10 y 10–11 dan 09–11; un hueco
 * abre otro tramo. Cada tramo se guarda como un bloqueo.
 */
export function tramosContiguos(franjas: Tramo[]): Tramo[] {
  const tramos: Tramo[] = []
  for (const franja of [...franjas].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
    const ultimo = tramos[tramos.length - 1]
    if (ultimo && ultimo.endTime >= franja.startTime) {
      if (franja.endTime > ultimo.endTime) ultimo.endTime = franja.endTime
    } else {
      tramos.push({ ...franja })
    }
  }
  return tramos
}
