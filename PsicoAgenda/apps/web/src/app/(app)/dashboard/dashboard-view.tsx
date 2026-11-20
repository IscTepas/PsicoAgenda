"use client"

import { TusSolicitudes } from "./tus-solicitudes"
import { MINUTOS_ANTES_DE_ATENDER } from "@/components/cobro-cita"
import { PendingInbox } from "./pending-inbox"
import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { MisTareas } from "./mis-tareas"
import { LibretaSesionDialog } from "../components/libreta-sesion"
import { BorradoresDeBitacora } from "../components/borradores-bitacora"
import {
  CalendarPlus,
  ChevronRight,
  MapPin,
  Plus,
  Video,
} from "lucide-react"
import {
  AppointmentStatus,
  AppointmentModality,
  UserRole,
  type Appointment,
  type PatientProfile,
  type PsychologistProfile,
} from "@psicoagenda/shared"
import { Calendar } from "@/components/arc/calendar/calendar"
import { PRACTICE } from "@/app/home-content"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/toast-provider"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useSession } from "@/lib/use-session"
import { useHydrated } from "@/lib/use-hydrated"
import { cn } from "@/lib/utils"
import { formatAppointmentTime, formatShortDate } from "@/lib/format"
import { appointmentService, patientService, psychologistService } from "@/services"
import { useDashboardData } from "./use-dashboard-data"
import { DetalleCitaDialog, SesionDialog } from "./sesion-dialog"
import { dinero, montoDe } from "@/components/cobro-cita"
import { useEnlaceVideollamada } from "@/lib/use-enlace-videollamada"

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const CLOCK_TICK = 30_000

function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (name[0] ?? "P").toUpperCase()
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  )
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function getEndTime(apt: Appointment): Date {
  return new Date(new Date(apt.startTime).getTime() + (apt.durationMinutes || 50) * MINUTE)
}

function isOpenAppointment(apt: Appointment): boolean {
  return apt.status === AppointmentStatus.CONFIRMED || apt.status === AppointmentStatus.PENDING
}

/** "en 25 min", "en 2 h 10 min", "mañana", "en 3 días". */
function formatRelative(target: Date, now: Date): string {
  const minutes = Math.round((target.getTime() - now.getTime()) / MINUTE)
  if (minutes <= 0) return "ahora"
  if (isSameDay(target, now)) {
    if (minutes < 60) return `en ${minutes} min`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `en ${hours} h ${rest} min` : `en ${hours} h`
  }
  const days = Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / DAY)
  return days === 1 ? "mañana" : `en ${days} días`
}

// Reloj compartido: avanza cada 30 s. En el servidor no hay "ahora" (null), así
// la cuenta regresiva y la línea de tiempo solo aparecen ya hidratadas.
function subscribeClock(onTick: () => void) {
  const id = setInterval(onTick, CLOCK_TICK)
  return () => clearInterval(id)
}
const getClockSnapshot = () => Math.floor(Date.now() / CLOCK_TICK) * CLOCK_TICK
const getServerClockSnapshot = () => null

function useNow(): Date | null {
  const timestamp = useSyncExternalStore(subscribeClock, getClockSnapshot, getServerClockSnapshot)
  return useMemo(() => (timestamp === null ? null : new Date(timestamp)), [timestamp])
}

// Un solo estilo de estado en todo el panel: pastilla neutra + punto de color.
const STATUS_META: Record<AppointmentStatus, { label: string; dot: string }> = {
  [AppointmentStatus.CONFIRMED]: { label: "Confirmada", dot: "bg-primary" },
  [AppointmentStatus.PENDING]: { label: "Por confirmar", dot: "bg-amber-500" },
  [AppointmentStatus.COMPLETED]: { label: "Completada", dot: "bg-muted-foreground/50" },
  [AppointmentStatus.CANCELLED]: { label: "Cancelada", dot: "bg-destructive" },
  [AppointmentStatus.NO_SHOW]: { label: "No asistió", dot: "bg-muted-foreground/50" },
}

function StatusLabel({ status, label }: { status: AppointmentStatus; label?: string }) {
  const meta = STATUS_META[status]
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium text-foreground/80">
      <span className={cn("size-1.5 rounded-full", meta.dot)} aria-hidden="true" />
      {label ?? meta.label}
    </span>
  )
}

function ModalityLabel({ modality }: { modality: AppointmentModality }) {
  const isVirtual = modality === AppointmentModality.VIRTUAL
  const Icon = isVirtual ? Video : MapPin
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {isVirtual ? "Virtual" : "Presencial"}
    </span>
  )
}

/** Indicador "en vivo": late solo mientras una sesión está en curso. */
function LiveDot({ pulsing }: { pulsing: boolean }) {
  return (
    <span className="relative flex size-2" aria-hidden="true">
      {pulsing && (
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
      )}
      <span className="relative inline-flex size-2 rounded-full bg-primary" />
    </span>
  )
}

type SessionUser = ReturnType<typeof useSession>["user"]

function PsychologistDashboardView({ user }: { user: SessionUser }) {
  const [activeSessionAppointment, setActiveSessionAppointment] = useState<Appointment | null>(null)
  // Si la libreta se abrió desde la sesión, al cerrarla se vuelve a la sesión para cerrarla.
  const [volverASesion, setVolverASesion] = useState<Appointment | null>(null)
  const [detalleDe, setDetalleDe] = useState<Appointment | null>(null)
  const [notasAbiertas, setNotasAbiertas] = useState<ReadonlySet<string>>(new Set())
  const [avisoLibreta, setAvisoLibreta] = useState<string | undefined>(undefined)
  const abrirLibreta = (apt: Appointment, aviso?: string) => {
    setNotasAbiertas((prev) => new Set(prev).add(apt.id))
    setAvisoLibreta(aviso)
    setLibretaDe(apt)
  }
  const enlaceVideollamada = useEnlaceVideollamada()
  const [libretaDe, setLibretaDe] = useState<Appointment | null>(null)
  const { toast } = useToast()
  const listRef = useRef<HTMLElement>(null)
  const today = useMemo(() => new Date(), [])
  const fromToday = useMemo(() => startOfDay(today), [today])
  const toNextDays = useMemo(() => new Date(today.getTime() + 90 * DAY), [today])

  // Desde 60 días atrás: tocar un día pasado en el calendario también muestra sus citas.
  const desdeHistorial = useMemo(() => new Date(fromToday.getTime() - 60 * DAY), [fromToday])
  const { appointments, patients } = useDashboardData({ from: desdeHistorial, to: toNextDays })

  const queryClient = useQueryClient()
  const refetchAppointments = () =>
    queryClient.invalidateQueries({ queryKey: ["appointments", "dashboard"] })

  const patientById = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  )

  // Mini-calendario state
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date())

  const now = useNow()
  const clock = now ?? today
  const hydrated = useHydrated()

  // Nombre y saludo personalizado: "Hola, Psic. [Nombre]"
  const rawName = user?.name || "Psicólogo"
  const cleanName = rawName.replace(/^(Dra\.|Dr\.|Psic\.|Lic\.)\s*/i, "")
  const psychologistGreeting = `Hola, Psic. ${cleanName}`

  const todayAppointments = useMemo(
    () =>
      appointments
        .filter((apt) => isSameDay(new Date(apt.startTime), today))
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [appointments, today]
  )

  // Qué sigue: la sesión en curso o, si no hay, la próxima abierta de hoy.
  const openToday = todayAppointments.filter(isOpenAppointment)
  const currentAppointment =
    openToday.find((apt) => new Date(apt.startTime) <= clock && clock < getEndTime(apt)) ?? null
  const upcomingAppointment = openToday.find((apt) => new Date(apt.startTime) > clock) ?? null
  const focusAppointment = currentAppointment ?? upcomingAppointment

  // Lista: el día elegido en el calendario (hoy por defecto)
  const isViewingToday = isSameDay(selectedCalendarDate, today)
  const porCerrar = appointments
    .filter((apt) => isOpenAppointment(apt) && getEndTime(apt) <= clock)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

  const sinNota = appointments
    .filter(
      (apt) =>
        apt.status === AppointmentStatus.COMPLETED &&
        !apt.hasSessionNote &&
        getEndTime(apt).getTime() > clock.getTime() - 7 * DAY,
    )
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  const pendientes = [
    ...porCerrar.map((apt) => ({ apt, tipo: "cerrar" as const })),
    ...sinNota.map((apt) => ({ apt, tipo: "nota" as const })),
  ]

  const desdeElegido = startOfDay(selectedCalendarDate)
  const citasDesde = appointments
    // Las que ya terminaron sin cerrarse se ven arriba, en "por cerrar"; aquí no se repiten.
    .filter(
      (apt) =>
        new Date(apt.startTime) >= desdeElegido &&
        apt.status !== AppointmentStatus.CANCELLED &&
        !porCerrar.some((p) => p.id === apt.id),
    )
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  const gruposPorDia: [Date, Appointment[]][] = []
  for (const apt of citasDesde) {
    const dia = startOfDay(new Date(apt.startTime))
    const ultimo = gruposPorDia[gruposPorDia.length - 1]
    if (ultimo && isSameDay(ultimo[0], dia)) ultimo[1].push(apt)
    else gruposPorDia.push([dia, [apt]])
  }
  const tituloDia = (dia: Date) => {
    if (isSameDay(dia, today)) return "Hoy"
    if (isSameDay(dia, new Date(fromToday.getTime() + DAY))) return "Mañana"
    return capitalize(dia.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }))
  }

  const selectedDayTitle = isViewingToday
    ? "Tus citas"
    : `Desde el ${selectedCalendarDate.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}`

  const selectDay = (day: Date) => {
    setSelectedCalendarDate(day)
    setCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1))
  }

  const showNotice = (message: string, status: "success" | "error" = "success") => {
    toast({ title: message, status })
  }

  // Confirmar una cita por venir sin salir de Inicio (al instante; se revierte si falla).
  const confirmarCita = async (apt: Appointment) => {
    const claves = { queryKey: ["appointments", "dashboard"] }
    const previas = queryClient.getQueriesData<Appointment[]>(claves)
    queryClient.setQueriesData<Appointment[]>(claves, (lista) =>
      lista?.map((a) => (a.id === apt.id ? { ...a, status: AppointmentStatus.CONFIRMED } : a)),
    )
    try {
      await appointmentService.changeStatus(apt.id, AppointmentStatus.CONFIRMED)
      void refetchAppointments()
      showNotice(`Cita con ${patientById.get(apt.patientId)?.name ?? "el paciente"} confirmada. Se le avisó.`)
    } catch {
      for (const [clave, datos] of previas) queryClient.setQueryData(clave, datos)
      showNotice("No se pudo confirmar la cita. Intenta de nuevo.", "error")
    }
  }

  // Lo que sigue a cerrar una sesión, venga de la ventana de la sesión o de la lista de pendientes.
  const trasCerrar = (cita: Appointment) => {
    setActiveSessionAppointment(null)
    void refetchAppointments()
    const nombre = patientById.get(cita.patientId)?.name ?? "el paciente"
    if (cita.status !== AppointmentStatus.COMPLETED) {
      showNotice(`Se registró que ${nombre} no asistió. Sin cargo.`)
      return
    }
    const cobrado = cita.payment?.amount !== undefined ? ` Cobro de ${dinero(Number(cita.payment.amount))} registrado.` : ""
    showNotice(`Sesión con ${nombre} cerrada.${cobrado}`)
    if (!notasAbiertas.has(cita.id)) {
      abrirLibreta(cita, `Sesión con ${nombre} cerrada. Escribe la bitácora ahora que la tienes fresca; si no puedes, ciérrala y queda como borrador.`)
    }
  }

  // Cerrar desde la lista de pendientes: con la tarifa de la cita (se corrige después si hace falta).
  const [cerrandoId, setCerrandoId] = useState<string | null>(null)
  const cerrarSesion = async (apt: Appointment, asistio: boolean) => {
    setCerrandoId(apt.id)
    try {
      trasCerrar(await appointmentService.close(apt.id, asistio, asistio ? montoDe(apt) : undefined))
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "No se pudo cerrar la sesión. Intenta de nuevo.", "error")
    } finally {
      setCerrandoId(null)
    }
  }

  const formattedTodayHeader = capitalize(
    today.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
  )

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-8" aria-busy="true">
        <div className="h-[86px] rounded-xl bg-muted/50 animate-pulse motion-reduce:animate-none" />
        <div className="h-[66px] rounded-2xl bg-muted/50 animate-pulse motion-reduce:animate-none" />
        <div className="h-[420px] rounded-xl bg-muted/50 animate-pulse motion-reduce:animate-none" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <BorradoresDeBitacora />

      {/* Encabezado: saludo + acciones principales */}
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{formattedTodayHeader}</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {psychologistGreeting}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild className="flex-1 active:scale-[0.97] sm:flex-none">
            <Link href="/agenda/nueva">
              <Plus />
              Nueva cita
            </Link>
          </Button>
        </div>
      </header>

      {/* Solicitudes y citas por confirmar: lo primero que se atiende al entrar. */}
      <PendingInbox />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Citas del día elegido. Las filas se adaptan al ancho de la tarjeta
            (container queries), no al de la ventana. */}
        <div className="min-w-0 space-y-8">
        {pendientes.length > 0 && (
          <section aria-labelledby="por-cerrar" className="@container space-y-4">
            <div className="flex flex-col gap-1 @lg:flex-row @lg:items-baseline @lg:justify-between">
              <h2 id="por-cerrar" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
                Pendientes de tus sesiones
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-foreground">
                  {pendientes.length}
                </span>
              </h2>
              <p className="text-sm text-muted-foreground">Ciérralas para registrar asistencia y cobro, y escribe su bitácora.</p>
            </div>
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {pendientes.slice(0, 6).map(({ apt, tipo }) => (
                <li key={apt.id} className="flex flex-col gap-2 px-4 py-3 @xl:flex-row @xl:items-center @2xl:px-5">
                  <span
                    className={`hidden size-2 shrink-0 rounded-full @xl:block ${tipo === "cerrar" ? "bg-amber-500" : "bg-primary"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {patientById.get(apt.patientId)?.name ?? "Paciente"}
                    </span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {isSameDay(new Date(apt.startTime), today) ? "Hoy" : formatShortDate(new Date(apt.startTime))} ·{" "}
                      {formatAppointmentTime(new Date(apt.startTime))}
                      {tipo === "nota" ? " · Asistió, falta la bitácora" : " · Sin cerrar"}
                    </span>
                  </span>
                  {tipo === "cerrar" ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={cerrandoId !== null}
                        onClick={() => void cerrarSesion(apt, false)}
                      >
                        No asistió
                      </Button>
                      <Button
                        size="sm"
                        disabled={cerrandoId !== null}
                        aria-busy={cerrandoId === apt.id}
                        onClick={() => void cerrarSesion(apt, true)}
                      >
                        Asistió · cobrar {dinero(montoDe(apt))}
                      </Button>
                    </span>
                  ) : (
                    <Button size="sm" variant="outline" className="shrink-0" onClick={() => abrirLibreta(apt)}>
                      Escribir bitácora
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {pendientes.length > 6 && <p className="px-1 text-sm text-muted-foreground">y {pendientes.length - 6} más</p>}
          </section>
        )}

        <section ref={listRef} className="@container scroll-mt-20 space-y-4">
          <div className="flex flex-col gap-3 @lg:flex-row @lg:items-center @lg:justify-between">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">{selectedDayTitle}</h2>
              {!isViewingToday && (
                <button
                  type="button"
                  onClick={() => selectDay(today)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Volver a hoy
                </button>
              )}
            </div>

            {citasDesde.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {citasDesde.length === 1 ? "1 cita" : `${citasDesde.length} citas`}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card [&>section:first-child>h3]:rounded-t-2xl [&>section:last-child_li:last-child]:rounded-b-2xl [&>section+section]:border-t [&>section+section]:border-border">
            {gruposPorDia.length > 0 ? (
              gruposPorDia.map(([dia, citasDelDia]) => (
              <section key={dia.toISOString()} aria-label={tituloDia(dia)}>
                <h3 className="sticky top-[5.25rem] z-10 flex items-baseline justify-between gap-3 border-b border-border/60 bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))] px-4 py-2 text-xs font-semibold text-muted-foreground @2xl:px-5">
                  <span className={isSameDay(dia, today) ? "text-primary" : undefined}>{tituloDia(dia)}</span>
                  <span className="font-normal tabular-nums">
                    {citasDelDia.length === 1 ? "1 cita" : `${citasDelDia.length} citas`}
                  </span>
                </h3>
              <ul className="divide-y divide-border">
                {citasDelDia.map((apt) => {
                  const esHoy = isSameDay(new Date(apt.startTime), today)
                  const patient = patientById.get(apt.patientId)
                  const patientName = patient?.name || "Paciente"
                  const isNext = esHoy && apt.id === focusAppointment?.id
                  const isLive = isNext && apt.id === currentAppointment?.id
                  const isClosed = !isOpenAppointment(apt)
                  const isUnregistered = esHoy && !isClosed && getEndTime(apt) <= clock
                  // "Atender" se habilita poco antes de la hora; antes de eso solo se ve el detalle.
                  const puedeAtender = esHoy && !isClosed && new Date(apt.startTime).getTime() - MINUTOS_ANTES_DE_ATENDER * 60_000 <= clock.getTime()

                  return (
                    <li
                      key={apt.id}
                      className={cn(
                        "flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/30 @2xl:flex-row @2xl:items-center @2xl:gap-5 @2xl:px-5",
                        isNext && "bg-primary/[0.04]",
                        isClosed && "text-muted-foreground"
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div className="w-[4.5rem] shrink-0 whitespace-nowrap">
                          <p className={cn("text-sm font-semibold tabular-nums", isClosed ? "text-muted-foreground" : "text-foreground")}>
                            {formatAppointmentTime(new Date(apt.startTime))}
                          </p>
                          <p className="text-xs tabular-nums text-muted-foreground">
                            {formatAppointmentTime(getEndTime(apt))}
                          </p>
                        </div>

                        <div
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                            isClosed ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                          )}
                        >
                          {getInitials(patientName)}
                        </div>

                        <div className="min-w-0">
                          <p className={cn("flex items-center gap-2 truncate text-sm font-medium", isClosed ? "text-muted-foreground" : "text-foreground")}>
                            <span className="truncate">{patientName}</span>
                            {patient?.isMinor && (
                              <span className="text-xs font-normal text-muted-foreground">Menor</span>
                            )}
                            {isNext && (
                              <span className="flex items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                {isLive && (
                                  <span className="relative flex size-1.5" aria-hidden="true">
                                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground opacity-70 motion-reduce:hidden" />
                                    <span className="relative inline-flex size-1.5 rounded-full bg-primary-foreground" />
                                  </span>
                                )}
                                {isLive ? "En curso" : "Siguiente"}
                              </span>
                            )}
                          </p>
                          <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                            <ModalityLabel modality={apt.modality} />
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{apt.reason || "Sesión de terapia"}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 @2xl:justify-end">
                        {isUnregistered ? (
                          <StatusLabel status={AppointmentStatus.PENDING} label="Sin registrar" />
                        ) : (
                          <StatusLabel status={apt.status} />
                        )}
                        <div className="flex items-center gap-1">
                          {puedeAtender ? (
                            <Button size="sm" onClick={() => setActiveSessionAppointment(apt)}>
                              {isUnregistered ? "Cerrar" : "Atender"}
                            </Button>
                          ) : apt.status === AppointmentStatus.PENDING ? (
                            <Button size="sm" variant="outline" onClick={() => void confirmarCita(apt)}>
                              Confirmar
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => setDetalleDe(apt)}>
                              Detalles
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
              </section>
              ))
            ) : (
              <div className="space-y-1 px-6 py-10 text-center">
                <p className="text-sm font-medium text-foreground">No tienes citas agendadas desde este día.</p>
                <p className="text-sm text-muted-foreground">Las nuevas aparecerán aquí en cuanto se agenden.</p>
              </div>
            )}
          </div>
        </section>
        </div>

        <div className="content-start space-y-6">
          {/* Mini-calendario: tocar un día muestra sus citas en la lista */}
          <aside className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <Calendar
              className="w-full"
              value={selectedCalendarDate}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              onChange={selectDay}
              hasMarker={(day) =>
                appointments.some(
                  (a) => a.status !== AppointmentStatus.CANCELLED && isSameDay(new Date(a.startTime), day),
                )
              }
              showToday
            />

            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                Días con citas
              </span>
              <Link
                href="/agenda"
                className="flex items-center gap-0.5 font-medium text-primary hover:underline"
              >
                Ver agenda
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </aside>

        </div>
      </div>

      {/* Iniciar sesión / registrar asistencia */}
      {libretaDe && (
        <LibretaSesionDialog
          key={libretaDe.id}
          open
          onOpenChange={(open) => {
            if (open) return
            setLibretaDe(null)
            if (volverASesion) {
              setActiveSessionAppointment(volverASesion)
              setVolverASesion(null)
            }
          }}
          patientId={libretaDe.patientId}
          patientName={patientById.get(libretaDe.patientId)?.name}
          aviso={avisoLibreta}
          onSaved={() => void refetchAppointments()}
          appointmentId={libretaDe.id}
          sessionDate={new Date(libretaDe.startTime)}
        />
      )}

      {detalleDe && (
        <DetalleCitaDialog
          cita={detalleDe}
          paciente={patientById.get(detalleDe.patientId)?.name ?? "Paciente"}
          onClose={() => setDetalleDe(null)}
        />
      )}

      {activeSessionAppointment && (
        <SesionDialog
          cita={activeSessionAppointment}
          paciente={patientById.get(activeSessionAppointment.patientId)?.name ?? "Paciente"}
          enlaceVideollamada={enlaceVideollamada}
          ahora={clock}
          onClose={() => setActiveSessionAppointment(null)}
          onBitacora={() => {
            setVolverASesion(activeSessionAppointment)
            abrirLibreta(activeSessionAppointment)
            setActiveSessionAppointment(null)
          }}
          onCerrada={trasCerrar}
        />
      )}
    </div>
  )
}

function PatientDashboardView({ user }: { user: SessionUser }) {
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [psychologist, setPsychologist] = useState<PsychologistProfile | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const { toast } = useToast()
  const now = useNow()
  const hydrated = useHydrated()

  // Modales
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("Inconveniente de horario o imprevisto")
  const [otherReason, setOtherReason] = useState("")
  const [isCancelling, setIsCancelling] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        // La API acota las citas al paciente autenticado (por su rol).
        const [patientProfile, appointmentRows] = await Promise.all([patientService.getMe(), appointmentService.list()])
        if (cancelled) return
        setProfile(patientProfile)
        setAppointments(appointmentRows)

        if (patientProfile.psychologistId) {
          const therapist = await psychologistService.getById(patientProfile.psychologistId)
          if (!cancelled) setPsychologist(therapist)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "No se pudo cargar tu información.",
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // Nombre amigable para el saludo: "Hola, [Nombre]"
  const displayName = profile?.name ?? user?.name ?? ""
  const cleanFirstName = displayName.trim().split(" ")[0] || "Paciente"
  const friendlyGreeting = `Hola, ${cleanFirstName}`

  const patientAppointments = useMemo(() => {
    if (!profile) return appointments
    return appointments.filter((a) => a.patientId === profile.id)
  }, [appointments, profile])

  const today = useMemo(() => (now ? startOfDay(now) : null), [now])
  const clock = now ?? today

  // Próximas citas: abiertas y que todavía no terminan
  const upcomingAppointments = useMemo(() => {
    if (!clock) return []
    return patientAppointments
      .filter((a) => isOpenAppointment(a) && getEndTime(a) > clock)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [patientAppointments, clock])

  const nextAppointment = upcomingAppointments[0] || null

  const handleCancelAppointment = async (aptId: string) => {
    const finalReason = cancellationReason === "Otro" ? (otherReason || "Sin especificar") : cancellationReason
    setIsCancelling(true)
    try {
      const updated = await appointmentService.cancel(aptId, finalReason)
      setAppointments((prev) => prev.map((apt) => (apt.id === aptId ? updated : apt)))
      setCancelModalOpen(false)
      toast({
        title: "Cita cancelada",
        description: "Tu psicólogo/a ya fue notificado/a.",
        status: "success",
      })
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo cancelar la cita.", status: "error" })
    } finally {
      setIsCancelling(false)
    }
  }

  const formatHeroDate = (date: Date | string) =>
    capitalize(
      new Date(date).toLocaleDateString("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    )

  const nextStart = nextAppointment ? new Date(nextAppointment.startTime) : null
  const countdown =
    now && nextStart
      ? nextStart <= now
        ? "en curso"
        : isSameDay(nextStart, now)
          ? `hoy, ${formatRelative(nextStart, now)}`
          : formatRelative(nextStart, now)
      : null

  if (!hydrated || isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-8" aria-busy="true">
        <div className="h-[86px] rounded-xl bg-muted/50 animate-pulse motion-reduce:animate-none" />
        <div className="h-[66px] rounded-2xl bg-muted/50 animate-pulse motion-reduce:animate-none" />
        <div className="h-[420px] rounded-xl bg-muted/50 animate-pulse motion-reduce:animate-none" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {friendlyGreeting}
          </h1>
        </header>
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive"
        >
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Encabezado */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {friendlyGreeting}
          </h1>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <Button asChild>
            <Link href="/agenda/nueva">
              <Plus />
              Solicitar cita
            </Link>
          </Button>
        </div>
      </header>

      {/* Lo que el paciente tiene que atender: cancelaciones, cambios propuestos y sus solicitudes. */}
      <TusSolicitudes
        appointments={appointments}
        onCambio={() => void appointmentService.list().then(setAppointments)}
      />

      <MisTareas />

      {/* Próxima cita */}
      {nextAppointment && nextStart ? (
        <section className="space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-primary">
                <LiveDot pulsing={false} />
                <span className="whitespace-nowrap">Tu próxima cita</span>
                {countdown && (
                  <span className="whitespace-nowrap font-normal text-muted-foreground">· {countdown}</span>
                )}
              </p>
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
                {formatHeroDate(nextStart)}
              </h2>
              <p className="text-base tabular-nums text-muted-foreground">
                {formatAppointmentTime(nextStart)} – {formatAppointmentTime(getEndTime(nextAppointment))}
              </p>
              <div className="pt-2 sm:hidden">
                <StatusLabel status={nextAppointment.status} />
              </div>
            </div>
            <div className="hidden sm:block">
              <StatusLabel status={nextAppointment.status} />
            </div>
          </div>

          <dl className="grid gap-6 border-t border-border pt-6 sm:grid-cols-3">
            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">Modalidad</dt>
              <dd className="flex items-center gap-2 text-sm font-medium text-foreground">
                {nextAppointment.modality === AppointmentModality.VIRTUAL ? (
                  <>
                    <Video className="size-4 text-primary" />
                    Videollamada
                  </>
                ) : (
                  <>
                    <MapPin className="size-4 text-primary" />
                    Presencial
                  </>
                )}
              </dd>
              <dd className="text-xs leading-relaxed text-muted-foreground">
                {nextAppointment.modality === AppointmentModality.VIRTUAL
                  ? "El enlace se habilita antes de la hora."
                  : PRACTICE.address}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-xs text-muted-foreground">Psicólogo/a</dt>
              <dd className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {getInitials((psychologist?.name ?? "Tu terapeuta").replace(/^(Dra\.|Dr\.)\s*/i, ""))}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {psychologist?.name ?? "Tu terapeuta asignado"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {psychologist?.specialty ?? "Psicología clínica"}
                  </span>
                </span>
              </dd>
            </div>

            {nextAppointment.reason && (
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">Motivo</dt>
                <dd className="text-sm text-foreground">{nextAppointment.reason}</dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-6">
            {nextAppointment.modality === AppointmentModality.VIRTUAL &&
              (psychologist?.videoCallUrl ? (
                <Button asChild className="w-full sm:w-auto">
                  <a href={psychologist.videoCallUrl} target="_blank" rel="noopener noreferrer">
                    <Video />
                    Entrar a la videollamada
                  </a>
                </Button>
              ) : (
                <p className="w-full text-sm text-muted-foreground sm:w-auto">
                  Tu psicóloga te compartirá el enlace de la videollamada.
                </p>
              ))}
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setRescheduleModalOpen(true)}
            >
              Modificar cita
            </Button>
            <Button
              variant="ghost"
              onClick={() => setCancelModalOpen(true)}
              className="flex-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:flex-none"
            >
              Cancelar
            </Button>
            <Link
              href={`/agenda/${nextAppointment.id}`}
              className="flex w-full items-center justify-center gap-0.5 pt-1 text-sm font-medium text-primary hover:underline sm:ml-auto sm:w-auto sm:pt-0"
            >
              Ver detalles
              <ChevronRight className="size-4" />
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card px-6 py-12 text-center sm:py-16">
          <div className="mx-auto max-w-sm space-y-4">
            <CalendarPlus className="mx-auto size-8 text-primary" strokeWidth={1.5} />
            <div className="space-y-1.5">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                No tienes citas próximas
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Cuando solicites una cita y tu psicóloga la confirme, aparecerá aquí.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Acción principal flotante (móvil) */}
      <Link
        href="/agenda/nueva"
        className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform active:scale-95 lg:hidden"
      >
        <Plus className="size-4" />
        Solicitar cita
      </Link>

      {/* Modificar cita */}
      {nextAppointment && (
        <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight">Modificar cita</DialogTitle>
              <DialogDescription>
                Tu cita actual es el {formatHeroDate(nextAppointment.startTime).toLowerCase()} a las{" "}
                {/* La hora ya termina en "p.m.": sin punto extra. */}
                {formatAppointmentTime(new Date(nextAppointment.startTime)).replace(/\.$/, "")}. Podrás elegir un nuevo
                horario según la disponibilidad de {psychologist?.name ?? "tu psicólogo/a"}.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setRescheduleModalOpen(false)}>
                Volver
              </Button>
              <Button asChild>
                <Link href={`/agenda/${nextAppointment.id}`}>Elegir nueva fecha</Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Cancelar */}
      {nextAppointment && (
        <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight">Cancelar cita</DialogTitle>
              <DialogDescription>
                {formatHeroDate(nextAppointment.startTime)} · {formatAppointmentTime(new Date(nextAppointment.startTime)).replace(/\.$/, "")}.
                Cuéntanos el motivo para avisar a tu psicólogo/a y liberar el espacio.
              </DialogDescription>
            </DialogHeader>

            <fieldset className="space-y-2">
              <legend className="sr-only">Motivo de cancelación</legend>
              {[
                "Inconveniente de horario o imprevisto",
                "Motivos de salud física",
                "Compromiso laboral o escolar",
                "Otro",
              ].map((reason) => (
                <label
                  key={reason}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors",
                    cancellationReason === reason
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <input
                    type="radio"
                    name="cancel-reason"
                    value={reason}
                    checked={cancellationReason === reason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    className="accent-primary"
                  />
                  {reason}
                </label>
              ))}

              {cancellationReason === "Otro" && (
                <textarea
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Escribe brevemente el motivo"
                  rows={2}
                  className="w-full rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-sm text-foreground outline-none animate-in fade-in slide-in-from-top-1 duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
                />
              )}
            </fieldset>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setCancelModalOpen(false)}>
                Mantener cita
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleCancelAppointment(nextAppointment.id)}
                disabled={isCancelling}
              >
                {isCancelling ? "Cancelando…" : "Cancelar cita"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export function DashboardView() {
  const { user } = useSession()
  const effectiveRole = user?.role ?? (user?.email?.toLowerCase().includes("paciente") ? UserRole.PATIENT : UserRole.PSYCHOLOGIST)

  if (effectiveRole === UserRole.PATIENT) {
    return <PatientDashboardView user={user} />
  }

  return <PsychologistDashboardView user={user} />
}
