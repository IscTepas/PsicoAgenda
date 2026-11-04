import { describe, expect, it } from "vitest"
import {
  AppointmentModality,
  AppointmentRequestStatus,
  AppointmentStatus,
} from "@psicoagenda/shared"

import { accionesDeAviso, type ContextoDeAviso } from "@/lib/notificaciones"

const CITA = "11111111-1111-4111-8111-111111111111"
const AHORA = new Date("2030-01-01T10:00:00Z")
const ctx = (over: Partial<ContextoDeAviso> = {}): ContextoDeAviso => ({
  esPaciente: true,
  ahora: AHORA,
  mapsUrl: "https://maps.test",
  videoUrl: "https://video.test",
  ...over,
})
const futura = (modality: AppointmentModality) => ({
  modality,
  startTime: new Date("2030-01-02T10:00:00Z"),
  status: AppointmentStatus.CONFIRMED,
})

describe("accionesDeAviso", () => {
  it("confirmaciones, cambios, recordatorios y asistencia llevan a la cita", () => {
    for (const kind of ["confirmation", "change", "reminder", "attendance"] as const) {
      expect(accionesDeAviso({ kind, appointmentId: CITA }, ctx()).principal).toEqual({
        href: `/agenda/${CITA}`,
        label: "Ver cita",
      })
    }
  })

  it("una cita en línea vigente ofrece Videollamada; una presencial, Cómo llegar al paciente", () => {
    const virtual = accionesDeAviso({ kind: "reminder", appointmentId: CITA }, ctx({ cita: futura(AppointmentModality.VIRTUAL) }))
    expect(virtual.extras.map((a) => a.label)).toEqual(["Videollamada"])

    const presencial = accionesDeAviso({ kind: "confirmation", appointmentId: CITA }, ctx({ cita: futura(AppointmentModality.IN_PERSON) }))
    expect(presencial.extras).toEqual([{ href: "https://maps.test", label: "Cómo llegar", external: true }])
  })

  it("no ofrece Videollamada ni Cómo llegar para una cita que ya pasó o se canceló", () => {
    const pasada = { ...futura(AppointmentModality.VIRTUAL), startTime: new Date("2029-12-01T10:00:00Z") }
    expect(accionesDeAviso({ kind: "reminder", appointmentId: CITA }, ctx({ cita: pasada })).extras).toEqual([])
    const cancelada = { ...futura(AppointmentModality.IN_PERSON), status: AppointmentStatus.CANCELLED }
    expect(accionesDeAviso({ kind: "change", appointmentId: CITA }, ctx({ cita: cancelada })).extras).toEqual([])
  })

  it("a la psicóloga, una solicitud muestra en qué quedó", () => {
    const pendiente = accionesDeAviso(
      { kind: "request", requestId: "s-1" },
      ctx({ esPaciente: false, estadoSolicitud: AppointmentRequestStatus.PENDING }),
    )
    expect(pendiente).toMatchObject({ estado: "Esperando tu respuesta", pendiente: true })

    const aceptada = accionesDeAviso(
      { kind: "request", requestId: "s-1" },
      ctx({ esPaciente: false, estadoSolicitud: AppointmentRequestStatus.ACCEPTED }),
    )
    expect(aceptada).toMatchObject({ estado: "Aceptada", pendiente: false })
  })

  it("al paciente, un rechazo o una cancelación lo llevan a pedir otro horario", () => {
    expect(accionesDeAviso({ kind: "rejection" }, ctx()).principal?.href).toBe("/agenda/nueva")
    expect(accionesDeAviso({ kind: "cancellation", appointmentId: CITA }, ctx()).principal?.href).toBe("/agenda/nueva")
  })

  it("a la psicóloga, una cancelación la lleva a la cita cancelada", () => {
    expect(accionesDeAviso({ kind: "cancellation", appointmentId: CITA }, ctx({ esPaciente: false })).principal?.href).toBe(
      `/agenda/${CITA}`,
    )
  })

  it("un aviso sin cita (p. ej. fin de tutela) solo se marca como leído", () => {
    expect(accionesDeAviso({ kind: "change" }, ctx())).toEqual({ principal: null, extras: [], estado: null, pendiente: false })
  })
})
