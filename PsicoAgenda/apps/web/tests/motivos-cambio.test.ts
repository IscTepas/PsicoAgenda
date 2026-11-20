import { AppointmentStatus } from "@psicoagenda/shared"
import { describe, expect, it } from "vitest"
import { resumenDeMotivos } from "../src/lib/motivos-cambio"

const cita = (cancellationReason?: string, status = AppointmentStatus.CANCELLED) => ({ status, cancellationReason })

describe("resumenDeMotivos", () => {
  it("separa cancelaciones de cambios de fecha y ordena por los más usados", () => {
    const resumen = resumenDeMotivos([
      cita("Motivo económico"),
      cita("Problema de transporte"),
      cita("Problema de transporte"),
      cita("Cambio de fecha: Compromiso laboral o escolar"),
      cita("Cambio de fecha:"),
      cita(undefined),
      cita("No cuenta: sigue confirmada", AppointmentStatus.CONFIRMED),
    ])

    expect(resumen.cancelaciones).toEqual([
      { motivo: "Problema de transporte", veces: 2 },
      { motivo: "Motivo económico", veces: 1 },
      { motivo: "Sin motivo registrado", veces: 1 },
    ])
    expect(resumen.cambios).toEqual([
      { motivo: "Compromiso laboral o escolar", veces: 1 },
      { motivo: "Sin motivo registrado", veces: 1 },
    ])
  })
})
