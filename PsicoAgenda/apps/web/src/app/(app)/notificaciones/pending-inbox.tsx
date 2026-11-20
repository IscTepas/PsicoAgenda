"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Loader2, MapPin, Video } from "lucide-react"
import {
  AppointmentModality,
  AppointmentStatus,
  type Appointment,
  type AppointmentRequest,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/toast-provider"
import { ApiError } from "@/lib/api-client"
import { formatAppointmentTime, formatShortDate } from "@/lib/format"
import { usePendingResponses } from "@/lib/use-pending-responses"
import { cn } from "@/lib/utils"
import { appointmentRequestService, appointmentService, patientService } from "@/services"

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
/** Cuánto se ve el resultado ("Aceptada") antes de que la fila se retire. */
const RESULT_MS = 1500

type Item =
  | { kind: "request"; id: string; source: AppointmentRequest }
  | { kind: "appointment"; id: string; source: Appointment }

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
const initials = (name: string) => {
  const parts = name.trim().split(" ")
  return (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : (name[0] ?? "P")).toUpperCase()
}
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const endOf = (start: Date, minutes: number) => new Date(start.getTime() + (minutes || 50) * MINUTE)
const isOpen = (apt: Appointment) =>
  apt.status === AppointmentStatus.CONFIRMED || apt.status === AppointmentStatus.PENDING

function Modality({ modality }: { modality: AppointmentModality }) {
  const virtual = modality === AppointmentModality.VIRTUAL
  const Icon = virtual ? Video : MapPin
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {virtual ? "Virtual" : "Presencial"}
    </span>
  )
}

/**
 * "Por responder" de la psicóloga: solicitudes y citas sin confirmar, tomadas en
 * vivo de la base (no de los avisos), con la respuesta en la misma fila.
 */
export function PendingInbox() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const pending = usePendingResponses(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  // Qué se está respondiendo y con qué acción: ese botón muestra el giro y su texto en curso.
  const [busy, setBusy] = useState<{ id: string; action: "accept" | "reject" | "confirm" } | null>(null)
  const busyId = busy?.id ?? null
  const enCurso = (id: string, action: "accept" | "reject" | "confirm", reposo: string, cargando: string) =>
    busy?.id === id && busy.action === action ? (
      <>
        <Loader2 className="animate-spin" aria-hidden="true" />
        {cargando}
      </>
    ) : (
      reposo
    )
  const [results, setResults] = useState<Record<string, string>>({})
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const today = useMemo(() => new Date(), [])
  const { data: patients = [] } = useQuery({
    queryKey: ["patients", "list", 100],
    queryFn: () => patientService.list({ limit: 100 }),
    staleTime: 60_000,
  })
  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])

  // La agenda de los próximos 4 meses, para avisar si una solicitud choca con otra cita.
  const { data: agenda = [] } = useQuery({
    queryKey: ["appointments", "inbox-agenda"],
    queryFn: () => {
      const from = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      return appointmentService.list({ from, to: new Date(from.getTime() + 120 * DAY), limit: 200 })
    },
    staleTime: 30_000,
  })

  const items: Item[] = useMemo(
    () => [
      ...pending.pendingRequests.map((source) => ({ kind: "request" as const, id: source.id, source })),
      ...pending.pendingAppointments
        .slice()
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .map((source) => ({ kind: "appointment" as const, id: source.id, source })),
    ],
    [pending.pendingRequests, pending.pendingAppointments]
  )

  const clashOf = (item: Item) => {
    const start = new Date(item.source.startTime)
    const end = endOf(start, item.source.durationMinutes)
    return agenda.find(
      (apt) =>
        apt.id !== item.id &&
        isOpen(apt) &&
        new Date(apt.startTime) < end &&
        start < endOf(new Date(apt.startTime), apt.durationMinutes)
    )
  }

  // Desde un aviso "Responder solicitud": la fila se resalta y se acomoda a la vista.
  const deepLinkHandled = useRef(false)
  useEffect(() => {
    if (deepLinkHandled.current || !pending.isFetched) return
    const requestId = new URLSearchParams(window.location.search).get("solicitud")
    if (!requestId) return
    deepLinkHandled.current = true
    router.replace("/notificaciones", { scroll: false })
    if (!items.some((item) => item.id === requestId)) {
      toast({ title: "Esta solicitud ya fue atendida.", status: "info" })
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- aplica una sola vez el enlace de la URL cuando llegan los pendientes
    setHighlightedId(requestId)
    requestAnimationFrame(() => {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      document.getElementById(`pendiente-${requestId}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" })
    })
    setTimeout(() => setHighlightedId(null), 2400)
  }, [pending.isFetched, items, router, toast])

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["appointment-requests"] })
    void queryClient.invalidateQueries({ queryKey: ["appointments"] })
    void queryClient.invalidateQueries({ queryKey: ["notifications"] })
  }

  const respond = async (item: Item, action: "accept" | "reject" | "confirm") => {
    if (busyId) return
    setBusy({ id: item.id, action })
    const name = patientById.get(item.source.patientId)?.name
    try {
      if (action === "accept") await appointmentRequestService.accept(item.id)
      else if (action === "reject") await appointmentRequestService.reject(item.id)
      else await appointmentService.changeStatus(item.id, AppointmentStatus.CONFIRMED)

      const label = action === "accept" ? "Aceptada" : action === "reject" ? "Rechazada" : "Confirmada"
      setResults((prev) => ({ ...prev, [item.id]: label }))
      setDetailId(null)
      toast({
        title:
          action === "reject"
            ? `Solicitud${name ? ` de ${name}` : ""} rechazada.`
            : `Cita${name ? ` con ${name}` : ""} ${action === "accept" ? "agendada y confirmada" : "confirmada"}.`,
        status: "success",
      })
      setTimeout(refresh, RESULT_MS)
    } catch (error) {
      // Otra pestaña (o el paciente) ya la resolvió: no es un error, es información.
      if (error instanceof ApiError && error.status === 409) {
        toast({ title: "Esta solicitud ya fue atendida.", status: "info" })
        setDetailId(null)
        refresh()
      } else {
        toast({ title: error instanceof Error ? error.message : "No se pudo responder.", status: "error" })
      }
    } finally {
      setBusy(null)
    }
  }

  const detail = items.find((item) => item.id === detailId) ?? null

  return (
    <section aria-labelledby="por-responder" className="@container space-y-3">
      <div className="flex items-center gap-2.5">
        <h2 id="por-responder" className="text-lg font-semibold tracking-tight text-foreground">
          Por responder
        </h2>
        {items.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
            {items.length}
          </span>
        )}
      </div>

      {pending.isLoading ? (
        <div className="h-24 animate-pulse rounded-2xl border border-border bg-muted/30" aria-busy="true" />
      ) : pending.isError ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">
          No se pudieron cargar los pendientes.{" "}
          <button type="button" onClick={() => void pending.refetch()} className="font-medium text-primary hover:underline">
            Reintentar
          </button>
        </p>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-primary" />
          <span>
            <span className="font-medium text-foreground">Nada por responder.</span> Las solicitudes nuevas aparecerán
            aquí.
          </span>
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {items.map((item) => {
            const start = new Date(item.source.startTime)
            const patient = patientById.get(item.source.patientId)
            const name = patient?.name ?? "Paciente"
            const clash = item.kind === "request" ? clashOf(item) : undefined
            const result = results[item.id]
            const disabled = busyId !== null || Boolean(result)

            return (
              <li
                key={item.id}
                id={`pendiente-${item.id}`}
                aria-busy={busyId === item.id}
                className={cn(
                  "flex flex-col gap-3 px-4 py-3.5 transition-colors duration-700 @2xl:flex-row @2xl:items-center @2xl:gap-5 @2xl:px-5",
                  item.id === highlightedId && "bg-amber-50 dark:bg-amber-500/10",
                  result && "opacity-60"
                )}
              >
                <button
                  type="button"
                  onClick={() => setDetailId(item.id)}
                  className="flex min-w-0 flex-1 items-center gap-3.5 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {initials(name)}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className="truncate">{name}</span>
                      {patient?.isMinor && <span className="text-xs font-normal text-muted-foreground">Menor</span>}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      <span>{item.kind === "request" ? "Solicitud" : "Cita sin confirmar"}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {sameDay(start, today) ? "Hoy" : capitalize(formatShortDate(start))} · {formatAppointmentTime(start)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <Modality modality={item.source.modality} />
                      {item.source.reason && (
                        <>
                          <span aria-hidden="true" className="hidden @lg:inline">·</span>
                          <span className="hidden truncate @lg:inline">{item.source.reason}</span>
                        </>
                      )}
                    </span>
                    {clash && (
                      <span className="mt-0.5 block text-xs font-medium text-destructive">
                        Choca con {patientById.get(clash.patientId)?.name ?? "otra cita"} (
                        {formatAppointmentTime(new Date(clash.startTime))})
                      </span>
                    )}
                  </span>
                </button>

                <div className="flex items-center justify-end gap-1.5">
                  {result ? (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground" role="status">
                      <CheckCircle2 className="size-4 text-primary" />
                      {result}
                    </span>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setDetailId(item.id)}>
                        Ver detalles
                      </Button>
                      {item.kind === "request" ? (
                        <>
                          <Button size="sm" variant="outline" disabled={disabled} onClick={() => void respond(item, "reject")}>
                            {enCurso(item.id, "reject", "Rechazar", "Rechazando…")}
                          </Button>
                          <Button
                            size="sm"
                            disabled={disabled || Boolean(clash)}
                            title={clash ? "Ese horario ya está ocupado" : undefined}
                            onClick={() => void respond(item, "accept")}
                          >
                            {enCurso(item.id, "accept", "Aceptar", "Aceptando…")}
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" disabled={disabled} onClick={() => void respond(item, "confirm")}>
                          {enCurso(item.id, "confirm", "Confirmar", "Confirmando…")}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Detalle: todo lo de la cita pedida; aquí también se responde */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetailId(null)}>
        {detail && (() => {
          const start = new Date(detail.source.startTime)
          const end = endOf(start, detail.source.durationMinutes)
          const patient = patientById.get(detail.source.patientId)
          const name = patient?.name ?? "Paciente"
          const age = patient?.birthDate
            ? Math.floor((today.getTime() - new Date(patient.birthDate).getTime()) / (365.25 * DAY))
            : null
          const others = agenda.filter((apt) => apt.id !== detail.id && isOpen(apt) && sameDay(new Date(apt.startTime), start))
          const clash = detail.kind === "request" ? clashOf(detail) : undefined
          const isRequest = detail.kind === "request"
          const rows: { label: string; value: React.ReactNode }[] = [
            { label: "Día", value: capitalize(start.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })) },
            { label: "Horario", value: <span className="tabular-nums">{formatAppointmentTime(start)} – {formatAppointmentTime(end)}</span> },
            { label: "Modalidad", value: <Modality modality={detail.source.modality} /> },
            { label: "Motivo", value: detail.source.reason || "Sin especificar" },
            {
              label: "Ese día",
              value: clash ? (
                <span className="text-destructive">
                  Choca con {patientById.get(clash.patientId)?.name ?? "otra cita"} ({formatAppointmentTime(new Date(clash.startTime))})
                </span>
              ) : others.length === 0 ? (
                "Sin otras citas"
              ) : (
                `${others.length} ${others.length === 1 ? "cita más" : "citas más"}`
              ),
            },
            { label: "Teléfono", value: <span className="tabular-nums">{patient?.phone || "—"}</span> },
            { label: "Correo", value: patient?.email || "—" },
            ...(isRequest
              ? [{ label: "Solicitada", value: capitalize(formatShortDate(new Date(detail.source.createdAt))) }]
              : []),
          ]

          return (
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  {isRequest ? "Solicitud de cita" : "Cita sin confirmar"}
                </DialogTitle>
                <DialogDescription>
                  {isRequest
                    ? "Revisa lo que pidió el paciente antes de responder."
                    : "La cita ya está en tu agenda, pero falta confirmarla."}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center gap-3">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials(name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold tracking-tight text-foreground">{name}</p>
                  <p className="text-sm text-muted-foreground">
                    {patient?.isMinor ? "Menor de edad" : "Adulto"}
                    {age !== null && <span className="tabular-nums"> · {age} años</span>}
                  </p>
                </div>
              </div>

              <dl className="divide-y divide-border rounded-xl bg-muted/40 text-sm">
                {rows.map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-2.5">
                    <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                    <dd className="min-w-0 text-right font-medium text-foreground">{row.value}</dd>
                  </div>
                ))}
              </dl>

              <DialogFooter className="gap-2 sm:items-center sm:justify-between sm:gap-2">
                <Button asChild variant="ghost" className="text-muted-foreground sm:mr-auto">
                  <Link href={`/pacientes/${detail.source.patientId}`}>Expediente</Link>
                </Button>
                {isRequest ? (
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button variant="outline" disabled={busyId !== null} onClick={() => void respond(detail, "reject")}>
                      {enCurso(detail.id, "reject", "Rechazar", "Rechazando…")}
                    </Button>
                    <Button disabled={busyId !== null || Boolean(clash)} onClick={() => void respond(detail, "accept")}>
                      {enCurso(detail.id, "accept", "Aceptar", "Aceptando…")}
                    </Button>
                  </div>
                ) : (
                  <Button disabled={busyId !== null} onClick={() => void respond(detail, "confirm")}>
                    {enCurso(detail.id, "confirm", "Confirmar", "Confirmando…")}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          )
        })()}
      </Dialog>
    </section>
  )
}
