const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const fecha = (s: string) => {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Período del mismo tamaño justo antes del elegido, para comparar.
 * Si el período son meses completos (p. ej. «Este mes»), el anterior también lo es.
 */
export function periodoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  const a = fecha(desde)
  const b = fecha(hasta)
  const finDeMes = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate() === b.getDate()
  if (a.getDate() === 1 && finDeMes) {
    const meses = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth() + 1
    return {
      desde: iso(new Date(a.getFullYear(), a.getMonth() - meses, 1)),
      hasta: iso(new Date(a.getFullYear(), a.getMonth(), 0)),
    }
  }
  const dias = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
  return {
    desde: iso(new Date(a.getFullYear(), a.getMonth(), a.getDate() - dias)),
    hasta: iso(new Date(a.getFullYear(), a.getMonth(), a.getDate() - 1)),
  }
}
