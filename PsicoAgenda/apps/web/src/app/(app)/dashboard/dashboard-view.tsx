"use client"

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { MisTareas } from "./mis-tareas"
import { LibretaSesionDialog } from "../components/libreta-sesion"
import { BorradoresDeBitacora } from "../components/borradores-bitacora"
import {
  CalendarPlus,
  ChevronRight,
  FileText,
  MapPin,
  Plus,
  Video,
} from "lucide-react"
import {
  AppointmentRequestStatus,
  AppointmentStatus,
  AppointmentModality,
  AttendanceStatus,
  UserRole,
  type Appointment,
  type AppointmentRequest,
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
import { appointmentRequestService, appointmentService, patientService, psychologistService } from "@/services"
import { useDashboardData } from "./use-dashboard-data"

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

type AgendaFilter = "all" | "confirmed" | "pending"

type SessionUser = ReturnType<typeof useSession>["user"]

function PsychologistDashboardView({ user }: { user: SessionUser }) {
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>("all")
  const [activeSessionAppointment, setActiveSessionAppointment] = useState<Appointment | null>(null)
  const [libretaDe, setLibretaDe] = useState<Appointment | null>(null)
  const { toast } = useToast()
  const listRef = useRef<HTMLElement>(null)
  const today = useMemo(() => new Date(), [])
  const fromToday = useMemo(() => startOfDay(today), [today])
  const toNextDays = useMemo(() => new Date(today.getTime() + 30 * DAY), [today])

  // Desde 60 días atrás: tocar un día pasado en el calendario también muestra sus citas.
  const desdeHistorial = useMemo(() => new Date(fromToday.getTime() - 60 * DAY), [fromToday])
  const { appointments, patients } = useDashboardData({ from: desdeHistorial, to: toNextDays })

  const queryClient = useQueryClient()
  const refetchAppointments = () =>
    queryClient.invalidateQueries({ queryKey: ["appointments", "dashboard"] })

  // Las siguientes 5 citas después de hoy (sin canceladas): "Próximos días".
  const proximosDias = useMemo(() => {
    const manana = new Date(fromToday.getTime() + DAY)
    return appointments
      .filter((apt) => new Date(apt.startTime) >= manana && apt.status !== AppointmentStatus.CANCELLED)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 5)
  }, [appointments, fromToday])

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

  const appointmentsOn = (day: Date) =>
    appointments
      .filter((apt) => isSameDay(new Date(apt.startTime), day))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

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
  const dayAppointments = appointmentsOn(selectedCalendarDate)
  const filteredDayAppointments = dayAppointments.filter((apt) => {
    if (agendaFilter === "confirmed") return apt.status === AppointmentStatus.CONFIRMED
    if (agendaFilter === "pending") return apt.status === AppointmentStatus.PENDING
    return true
  })

  const selectedDayTitle = isViewingToday
    ? "Citas de hoy"
    : capitalize(
        selectedCalendarDate.toLocaleDateString("es-MX", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })
      )

  const selectDay = (day: Date) => {
    setSelectedCalendarDate(day)
    setCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1))
    setAgendaFilter("all")
  }

  const showNotice = (message: string, status: "success" | "error" = "success") => {
    toast({ title: message, status })
  }

  const handleRegisterAttendance = async (aptId: string) => {
    try {
      await appointmentService.changeStatus(aptId, AppointmentStatus.COMPLETED)
      await refetchAppointments()
      setActiveSessionAppointment(null)
      showNotice("Asistencia registrada. La sesión quedó como completada.")
    } catch {
      showNotice("No se pudo registrar la asistencia. Intenta de nuevo.", "error")
    }
  }

  const handleConfirmAppointment = async (aptId: string) => {
    const claves = { queryKey: ["appointments", "dashboard"] }
    const previas = queryClient.getQueriesData<Appointment[]>(claves)
    queryClient.setQueriesData<Appointment[]>(claves, (lista) =>
      lista?.map((apt) => (apt.id === aptId ? { ...apt, status: AppointmentStatus.CONFIRMED } : apt)),
    )
    setActiveSessionAppointment(null)
    try {
      await appointmentService.changeStatus(aptId, AppointmentStatus.CONFIRMED)
      void refetchAppointments()
      const name = patientById.get(appointments.find((a) => a.id === aptId)?.patientId ?? "")?.name
      showNotice(name ? `Cita con ${name} confirmada.` : "Cita confirmada.")
    } catch {
      for (const [clave, datos] of previas) queryClient.setQueryData(clave, datos)
      showNotice("No se pudo confirmar la cita. Intenta de nuevo.", "error")
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


      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Citas del día elegido. Las filas se adaptan al ancho de la tarjeta
            (container queries), no al de la ventana. */}
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

            {dayAppointments.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {dayAppointments.length === 1 ? "1 cita" : `${dayAppointments.length} citas`}
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {filteredDayAppointments.length > 0 ? (
              <ul className="divide-y divide-border">
                {filteredDayAppointments.map((apt) => {
                  const patient = patientById.get(apt.patientId)
                  const patientName = patient?.name || "Paciente"
                  const isNext = isViewingToday && apt.id === focusAppointment?.id
                  const isLive = isNext && apt.id === currentAppointment?.id
                  const isClosed = !isOpenAppointment(apt)
                  const isUnregistered = isViewingToday && !isClosed && getEndTime(apt) <= clock

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
                          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
                            <Link href={`/pacientes/${apt.patientId}`}>Expediente</Link>
                          </Button>
                          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLibretaDe(apt)}>
                            Bitácora
                          </Button>
                          {isViewingToday && !isClosed ? (
                            <Button size="sm" onClick={() => setActiveSessionAppointment(apt)}>
                              {isUnregistered ? "Registrar" : "Iniciar"}
                            </Button>
                          ) : (
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/agenda/${apt.id}`}>Detalles</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="space-y-1 px-6 py-10 text-center">
                <p className="text-sm font-medium text-foreground">
                  {isViewingToday ? "Hoy no tienes citas." : "Sin citas este día."}
                </p>
                {proximosDias[0] && selectedCalendarDate >= fromToday ? (
                  <p className="text-sm text-muted-foreground">
                    La siguiente es el {formatShortDate(new Date(proximosDias[0].startTime))} a las{" "}
                    {formatAppointmentTime(new Date(proximosDias[0].startTime))} con{" "}
                    {patientById.get(proximosDias[0].patientId)?.name ?? "un paciente"}.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Elige otro día en el calendario.</p>
                )}
              </div>
            )}
          </div>
        </section>

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

          {/* Próximos días: lo que viene después de hoy. */}
      {proximosDias.length > 0 && (
        <section aria-labelledby="proximos-dias" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="proximos-dias" className="text-sm font-semibold text-foreground">
              Próximos días
            </h2>
          </div>
          <ul className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60 bg-card">
            {proximosDias.map((apt) => (
              <li key={apt.id}>
                <Link
                  href={`/agenda/${apt.id}`}
                  className="flex items-center gap-3 px-4 py-2.5 outline-none transition-colors duration-150 hover:bg-muted/40 focus-visible:bg-muted/50"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {patientById.get(apt.patientId)?.name ?? "Paciente"}
                    </span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {formatShortDate(new Date(apt.startTime))} · {formatAppointmentTime(new Date(apt.startTime))}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

        </div>
      </div>

      {/* Iniciar sesión / registrar asistencia */}
      {libretaDe && (
        <LibretaSesionDialog
          key={libretaDe.id}
          open
          onOpenChange={(open) => !open && setLibretaDe(null)}
          patientId={libretaDe.patientId}
          patientName={patientById.get(libretaDe.patientId)?.name}
          appointmentId={libretaDe.id}
          sessionDate={new Date(libretaDe.startTime)}
        />
      )}

      {activeSessionAppointment && (
        <Dialog
          open={Boolean(activeSessionAppointment)}
          onOpenChange={(open) => {
            if (!open) setActiveSessionAppointment(null)
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight">
                Sesión con {patientById.get(activeSessionAppointment.patientId)?.name ?? "paciente"}
              </DialogTitle>
              <DialogDescription>
                Registra la asistencia al terminar la consulta.
              </DialogDescription>
            </DialogHeader>

            <dl className="divide-y divide-border rounded-xl bg-muted/40 text-sm">
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Horario</dt>
                <dd className="font-medium tabular-nums">
                  {formatAppointmentTime(new Date(activeSessionAppointment.startTime))} –{" "}
                  {formatAppointmentTime(getEndTime(activeSessionAppointment))}
                </dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Modalidad</dt>
                <dd className="font-medium">
                  {activeSessionAppointment.modality === AppointmentModality.VIRTUAL ? "Videollamada" : "Presencial"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted-foreground">Motivo</dt>
                <dd className="truncate font-medium">{activeSessionAppointment.reason || "Sin especificar"}</dd>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5">
                <dt className="text-muted-foreground">Estado</dt>
                <dd>
                  <StatusLabel status={activeSessionAppointment.status} />
                </dd>
              </div>
            </dl>

            {activeSessionAppointment.modality === AppointmentModality.VIRTUAL && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open("https://meet.google.com/psi-diag-ses", "_blank")}
              >
                <Video />
                Unirse a la videollamada
              </Button>
            )}

            {/* La nota de la sesión se escribe (o se retoma) desde aquí, sin buscarla en el expediente. */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setLibretaDe(activeSessionAppointment)
                setActiveSessionAppointment(null)
              }}
            >
              <FileText />
              Escribir en la bitácora
            </Button>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" onClick={() => setActiveSessionAppointment(null)}>
                Cerrar
              </Button>
              {activeSessionAppointment.status === AppointmentStatus.PENDING && (
                <Button
                  variant="outline"
                  onClick={() => handleConfirmAppointment(activeSessionAppointment.id)}
                >
                  Confirmar cita
                </Button>
              )}
              {isOpenAppointment(activeSessionAppointment) && (
                <Button onClick={() => handleRegisterAttendance(activeSessionAppointment.id)}>
                  Registrar asistencia
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function PatientDashboardView({ user }: { user: SessionUser }) {
  const [profile, setProfile] = useState<PatientProfile | null>(null)
  const [psychologist, setPsychologist] = useState<PsychologistProfile | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [requests, setRequests] = useState<AppointmentRequest[]>([])
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
        const [patientProfile, appointmentRows, requestRows] = await Promise.all([
          patientService.getMe(),
          appointmentService.list(),
          appointmentRequestService.list(),
        ])
        if (cancelled) return
        setProfile(patientProfile)
        setAppointments(appointmentRows)
        setRequests(requestRows)

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

  const pastAppointments = useMemo(() => {
    if (!today) return []
    return patientAppointments
      .filter((a) => a.status === AppointmentStatus.COMPLETED || a.status === AppointmentStatus.CANCELLED || new Date(a.startTime) < today)
      .filter((a) => a.id !== nextAppointment?.id)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  }, [patientAppointments, today, nextAppointment])

  // Un tutor ve también las solicitudes de sus menores: se rotulan con su nombre.
  const { data: tutored = [] } = useQuery({
    queryKey: ["pacientes", "tutelados"],
    queryFn: patientService.listTutored,
    staleTime: 5 * 60_000,
  })
  const tutoredNames = useMemo(() => new Map(tutored.map((m) => [m.id, m.name])), [tutored])

  // Solicitudes que aún importan: las que esperan respuesta y los rechazos de fechas por venir.
  const openRequests = useMemo(() => {
    if (!clock) return []
    return requests.filter(
      (r) =>
        // Una solicitud cuya fecha ya pasó no tiene nada que esperar: no se muestra.
        (r.status === AppointmentRequestStatus.PENDING || r.status === AppointmentRequestStatus.REJECTED) &&
        new Date(r.startTime) > clock,
    )
  }, [requests, clock])

  const handleCancelRequest = async (requestId: string) => {
    try {
      const updated = await appointmentRequestService.cancel(requestId)
      setRequests((prev) => prev.map((r) => (r.id === requestId ? updated : r)))
      toast({ title: "Retiraste tu solicitud.", status: "success" })
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo retirar la solicitud.", status: "error" })
    }
  }

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


      {/* Solicitudes: lo que pediste y todavía no es cita */}
      {openRequests.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">Tus solicitudes</h2>
          <ul className="divide-y divide-border">
            {openRequests.map((request) => {
              const start = new Date(request.startTime)
              const isPending = request.status === AppointmentRequestStatus.PENDING
              return (
                <li key={request.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {formatHeroDate(start)} · <span className="tabular-nums">{formatAppointmentTime(start)}</span>
                      {tutoredNames.get(request.patientId) ? (
                        <span className="text-muted-foreground"> · para {tutoredNames.get(request.patientId)}</span>
                      ) : null}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className={cn("size-1.5 rounded-full", isPending ? "bg-amber-500" : "bg-destructive")}
                        aria-hidden="true"
                      />
                      {isPending ? "Esperando confirmación" : "No fue aceptada · elige otro horario"}
                    </p>
                  </div>
                  {isPending ? (
                    <Button size="sm" variant="ghost" onClick={() => handleCancelRequest(request.id)}>
                      Retirar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/agenda/nueva">Otro horario</Link>
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

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
            {nextAppointment.modality === AppointmentModality.VIRTUAL && (
              <Button
                className="w-full sm:w-auto"
                onClick={() => window.open("https://meet.google.com/psi-diag-ses", "_blank")}
              >
                <Video />
                Abrir videollamada
              </Button>
            )}
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

      {/* Citas recientes */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Citas recientes</h2>
          <Link
            href="/agenda"
            className="flex items-center gap-0.5 text-sm font-medium text-primary hover:underline"
          >
            Ver todas
            <ChevronRight className="size-4" />
          </Link>
        </div>

        {pastAppointments.length > 0 ? (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {pastAppointments.slice(0, 4).map((apt) => {
              const isAttended = apt.attendanceStatus === AttendanceStatus.ATTENDED || apt.status === AppointmentStatus.COMPLETED

              return (
                <li key={apt.id}>
                  <Link
                    href={`/agenda/${apt.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium tabular-nums text-foreground">
                        {formatShortDate(new Date(apt.startTime))} · {formatAppointmentTime(new Date(apt.startTime))}
                      </p>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <ModalityLabel modality={apt.modality} />
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{apt.reason || "Consulta"}</span>
                      </p>
                    </div>
                    <StatusLabel
                      status={isAttended ? AppointmentStatus.CONFIRMED : apt.status}
                      label={isAttended ? "Asistió" : undefined}
                    />
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            Aún no tienes citas anteriores.
          </div>
        )}
      </section>

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
