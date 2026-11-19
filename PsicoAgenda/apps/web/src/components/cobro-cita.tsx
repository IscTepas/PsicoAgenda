"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Loader2, Undo2 } from "lucide-react"
import { AppointmentStatus, PaymentStatus, type Appointment } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatShortDate } from "@/lib/format"
import { appointmentService } from "@/services"

const dinero = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)

/**
 * Cobro de una cita, el mismo en Inicio, Agenda y la sesión: el monto viene de la
 * tarifa pero se puede ajustar (descuento, sesión extra), se marca "Cobrado" o
 * "Sin costo" y cualquier error se deshace con un toque.
 */
export function CobroDeCita({
  cita,
  onActualizada,
}: {
  cita: Appointment
  onActualizada?: (cita: Appointment) => void
}) {
  const queryClient = useQueryClient()
  const [actual, setActual] = useState(cita)
  const estado = actual.payment?.status ?? PaymentStatus.PENDING
  const montoGuardado = Number(actual.payment?.amount ?? actual.price ?? 0)
  const [monto, setMonto] = useState(String(montoGuardado))
  const [guardando, setGuardando] = useState<PaymentStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (actual.status === AppointmentStatus.CANCELLED) return null

  const montoNumero = Number(monto)
  const montoValido = monto.trim() !== "" && Number.isFinite(montoNumero) && montoNumero >= 0

  const marcar = async (status: PaymentStatus) => {
    setGuardando(status)
    setError(null)
    try {
      const nueva = await appointmentService.updatePayment(
        actual.id,
        status,
        status === PaymentStatus.PAID ? montoNumero : undefined,
      )
      setActual(nueva)
      onActualizada?.(nueva)
      void queryClient.invalidateQueries({ queryKey: ["appointments"] })
      void queryClient.invalidateQueries({ queryKey: ["reports"] })
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el cobro.")
    } finally {
      setGuardando(null)
    }
  }

  const deshacer = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-8 text-muted-foreground"
      disabled={guardando !== null}
      onClick={() => void marcar(PaymentStatus.PENDING)}
    >
      {guardando === PaymentStatus.PENDING ? <Loader2 className="size-3.5 animate-spin" /> : <Undo2 className="size-3.5" />}
      Deshacer
    </Button>
  )

  return (
    <section aria-label="Cobro de la sesión" className="rounded-xl border border-border/60 bg-card p-3">
      {estado === PaymentStatus.PENDING ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`cobro-${actual.id}`} className="mr-auto text-sm font-medium text-foreground">
              Cobro
            </label>
            <div className="relative w-28">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id={`cobro-${actual.id}`}
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ""))}
                aria-invalid={!montoValido}
                className="h-9 rounded-lg pl-6 text-right tabular-nums"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-9 flex-1"
              disabled={guardando !== null || !montoValido}
              onClick={() => void marcar(PaymentStatus.PAID)}
            >
              {guardando === PaymentStatus.PAID ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              Cobrado
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9"
              disabled={guardando !== null}
              onClick={() => void marcar(PaymentStatus.WAIVED)}
            >
              {guardando === PaymentStatus.WAIVED && <Loader2 className="size-3.5 animate-spin" />}
              Sin costo
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Si te paga después, déjalo así: queda en «Por cobrar» en Reportes.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full ${estado === PaymentStatus.PAID ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
            aria-hidden="true"
          >
            <Check className="size-3.5" />
          </span>
          <p className="mr-auto text-sm">
            {estado === PaymentStatus.PAID ? (
              <>
                <span className="font-medium text-foreground">Cobrado {dinero(montoGuardado)}</span>
                {actual.payment?.paidAt && (
                  <span className="text-muted-foreground"> · {formatShortDate(actual.payment.paidAt)}</span>
                )}
              </>
            ) : (
              <span className="font-medium text-foreground">Sin costo</span>
            )}
          </p>
          {deshacer}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
