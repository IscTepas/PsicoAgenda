import { describe, expect, it } from "vitest"
import { franjasDesdeSemana, semanaDesdeFranjas } from "../src/lib/horario"

const slot = (dayOfWeek: number, h: number) => ({
  dayOfWeek,
  startTime: `${String(h).padStart(2, "0")}:00:00`,
  endTime: `${String(h + 1).padStart(2, "0")}:00:00`,
})

describe("horario disponible", () => {
  it("une horas seguidas en rangos y vuelve a las mismas franjas", () => {
    const slots = [slot(1, 9), slot(1, 10), slot(1, 12), slot(3, 16)]
    const semana = semanaDesdeFranjas(slots)
    expect(semana.mon.ranges.map((r) => [r.start, r.end])).toEqual([["09:00", "11:00"], ["12:00", "13:00"]])
    expect(semana.tue.enabled).toBe(false)

    const { franjas, error } = franjasDesdeSemana(semana)
    expect(error).toBeUndefined()
    expect(franjas).toHaveLength(4)
    expect(franjas).toContainEqual({ dayOfWeek: 3, hour: 16 })
  })

  it("no deja horarios encimados en el mismo día, pero sí uno de comida", () => {
    const semana = semanaDesdeFranjas([slot(1, 9)])
    semana.mon.ranges = [
      { id: "a", start: "09:00", end: "19:00" },
      { id: "b", start: "13:00", end: "15:00" },
    ]
    expect(franjasDesdeSemana(semana).error).toMatch(/encimados/)

    semana.mon.ranges = [
      { id: "a", start: "09:00", end: "13:00" },
      { id: "b", start: "15:00", end: "19:00" },
    ]
    const { franjas, error } = franjasDesdeSemana(semana)
    expect(error).toBeUndefined()
    expect(franjas.map((f) => f.hour)).toEqual([9, 10, 11, 12, 15, 16, 17, 18])
  })

  it("rechaza horas fuera del horario permitido o una semana vacía", () => {
    const semana = semanaDesdeFranjas([slot(1, 9)])
    semana.mon.ranges = [{ id: "x", start: "06:00", end: "08:00" }]
    expect(franjasDesdeSemana(semana).error).toMatch(/entre 7:00/)

    semana.mon.enabled = false
    expect(franjasDesdeSemana(semana).error).toMatch(/al menos/)
  })
})
