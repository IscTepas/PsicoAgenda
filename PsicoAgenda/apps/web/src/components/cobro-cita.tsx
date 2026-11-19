"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, CheckCircle2, Loader2, Pencil, UserX } from "lucide-react"
import { AppointmentStatus, PaymentStatus, type Appointment } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatShortDate } from "@/lib/format"
import { appointmentService } from "@/services"

export const dinero = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)

/** Lo que se cobra si no se ajusta: el monto ya registrado o la tarifa de la cita. */
export const montoDe = (cita: Appointment) => Number(cita.payment?.amount ?? cita.price ?? 0)

const montoValido = (texto: string) => texto.trim() !== "" && Number.isFinite(Number(texto)) && Number(texto) >= 0

/** Campo de monto en pesos: solo dígitos y punto. */
function CampoMonto({
  id,
  value,
  onChange,
  etiqueta,
}: {
  id: string
  value: string
  onChange: (valor: string) => void
  etiqueta: string
}) {
  return (
    <div className="relative w-28 shrink-0">
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">
        $
      </span>
      <Input
        id={id}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        aria-invalid={!montoValido(value) || undefined}
        className="h-10 rounded-lg pl-6 text-right tabular-nums"
      />
    </div>
  )
}

/**
 * Cobro de una sesión, el mismo en Inicio, Agenda, la cita y Reportes. El cobro
 * nace al cerrar la sesión: "Asistió" registra el pago (la tarifa, o el monto
 * ajustado) y "No asistió" la cierra sin cargo. Un cobro registrado no se
 * deshace: solo se corrige su monto.
 */
export function CobroDeCita({
  cita,
  ahora,
  onActualizada,
}: {
  cita: Appointment
  /** Reloj de referencia (el de la pantalla); por defecto, el actual. */
  ahora?: Date
  onActualizada?: (cita: Appointment) => void
}) {
  const queryClient = useQueryClient()
  const [actual, setActual] = useState(cita)
  const [monto, setMonto] = useState(String(montoDe(cita)))
  const [corrigiendo, setCorrigiendo] = useState(false)
  const [guardando, setGuardando] = useState<"asistio" | "no" | "monto" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const estado = actual.status
  const abierta = estado === AppointmentStatus.PENDING || estado === AppointmentStatus.CONFIRMED
  const yaEmpezo = new Date(actual.startTime).getTime() <= (ahora ?? new Date()).getTime()
  const cobrada = actual.payment?.status === PaymentStatus.PAID

  if (estado === AppointmentStatus.CANCELLED) return null

  const guardar = async (accion: "asistio" | "no" | "monto", llamada: () => Promise<Appointment>) => {
    setGuardando(accion)
    setError(null)
    try {
      const nueva = await llamada()
      setActual(nueva)
      setMonto(String(montoDe(nueva)))
      setCorrigiendo(false)
      onActualizada?.(nueva)
      void queryClient.invalidateQueries({ queryKey: ["appointments"] })
      void queryClient.invalidateQueries({ queryKey: ["reports"] })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar. Intenta de nuevo.")
    } finally {
      setGuardando(null)
    }
  }

  const cerrar = (asistio: boolean) =>
    guardar(asistio ? "asistio" : "no", () =>
      appointmentService.close(actual.id, asistio, asistio ? Number(monto) : undefined),
    )
  const registrarMonto = () =>
    guardar("monto", () => appointmentService.updatePayment(actual.id, PaymentStatus.PAID, Number(monto)))

  const mensajeError = error && (
    <p role="alert" className="mt-2 text-sm text-destructive">
      {error}
    </p>
  )

  // Abierta y sin empezar: todavía no hay nada que cobrar.
  if (abierta && !yaEmpezo) {
    return (
      <p className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm text-muted-foreground">
        Se cobra al cerrar la sesión: <span className="font-medium tabular-nums text-foreground">{dinero(montoDe(actual))}</span>
      </p>
    )
  }

  // Abierta y ya empezó (o terminó sin cerrarse): se cierra aquí, con su cobro.
  if (abierta) {
    return (
      <section aria-label="Cerrar la sesión" className="space-y-2.5 rounded-xl border border-border/60 bg-card p-3">
        <div className="flex items-center gap-2">
          <p className="mr-auto text-sm font-medium text-foreground">Cobro de la sesión</p>
          <CampoMonto id={`cobro-${actual.id}`} value={monto} onChange={setMonto} etiqueta="Monto a cobrar" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={guardando !== null}
            aria-busy={guardando === "no"}
            onClick={() => void cerrar(false)}
          >
            {guardando === "no" ? <Loader2 className="animate-spin" /> : <UserX />}
            No asistió
          </Button>
          <Button
            type="button"
            className="h-10 flex-1"
            disabled={guardando !== null || !montoValido(monto)}
            aria-busy={guardando === "asistio"}
            onClick={() => void cerrar(true)}
          >
            {guardando === "asistio" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Asistió · cobrar {montoValido(monto) ? dinero(Number(monto)) : ""}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Si no asistió, se cierra sin cargo.</p>
        {mensajeError}
      </section>
    )
  }

  if (estado === AppointmentStatus.NO_SHOW) {
    return (
      <p className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">No asistió</span> · sin cargo
      </p>
    )
  }

  // Atendida: el cobro registrado, con la opción de corregir el monto. Si es una
  // sesión cerrada antes de esta regla y quedó sin cobro, se registra aquí.
  return (
    <section aria-label="Cobro de la sesión" className="rounded-xl border border-border/60 bg-card p-3">
      {cobrada && !corrigiendo ? (
        <div className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
            <Check className="size-3.5" />
          </span>
          <p className="mr-auto text-sm">
            <span className="font-medium tabular-nums text-foreground">Cobrado {dinero(montoDe(actual))}</span>
            {actual.payment?.paidAt && (
              <span className="text-muted-foreground"> · {formatShortDate(actual.payment.paidAt)}</span>
            )}
          </p>
          <Button type="button" variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => setCorrigiendo(true)}>
            <Pencil className="size-3.5" />
            Corregir monto
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="mr-auto text-sm font-medium text-foreground">
              {cobrada ? "Corregir el monto cobrado" : "Registrar el cobro de esta sesión"}
            </p>
            <CampoMonto id={`cobro-${actual.id}`} value={monto} onChange={setMonto} etiqueta="Monto cobrado" />
          </div>
          <div className="flex justify-end gap-2">
            {cobrada && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9"
                disabled={guardando !== null}
                onClick={() => {
                  setCorrigiendo(false)
                  setMonto(String(montoDe(actual)))
                }}
              >
                Cancelar
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              className="h-9"
              disabled={guardando !== null || !montoValido(monto)}
              aria-busy={guardando === "monto"}
              onClick={() => void registrarMonto()}
            >
              {guardando === "monto" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {cobrada ? "Guardar monto" : `Registrar ${montoValido(monto) ? dinero(Number(monto)) : ""}`}
            </Button>
          </div>
        </div>
      )}
      {mensajeError}
    </section>
  )
}
