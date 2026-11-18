import { AppointmentStatus, type Appointment } from "@psicoagenda/shared"
import { describe, expect, it } from "vitest"
import { enCarriles } from "../src/app/(app)/agenda/components/semana-por-horas"

const cita = (id: string, hora: number, minutos = 50) =>
  ({ id, startTime: new Date(2026, 10, 20, hora, 0), durationMinutes: minutos, status: AppointmentStatus.CONFIRMED }) as Appointment

describe("enCarriles", () => {
  it("las citas que se enciman comparten el ancho; las sueltas lo usan completo", () => {
    const colocadas = enCarriles([cita("a", 10), cita("b", 10, 30), cita("c", 12)])
    const de = (id: string) => colocadas.find((c) => c.cita.id === id)!
    expect([de("a").carriles, de("b").carriles]).toEqual([2, 2])
    expect(de("a").carril).not.toBe(de("b").carril)
    expect(de("c")).toMatchObject({ carril: 0, carriles: 1 })
  })

  it("una cita que termina justo cuando empieza otra no las encima", () => {
    const colocadas = enCarriles([cita("a", 10, 60), cita("b", 11)])
    expect(colocadas.every((c) => c.carriles === 1)).toBe(true)
  })
})
