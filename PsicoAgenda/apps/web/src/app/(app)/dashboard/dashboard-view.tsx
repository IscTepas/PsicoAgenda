"use client"

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import {
  Bell,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
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
  type Patient,
  type PatientProfile,
  type PsychologistProfile,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
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
import { appointmentRequestService, appointmentService, patientService, psychologistService, notificationService } from "@/services"

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

function formatHourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12} ${hour < 12 ? "a.m." : "p.m."}`
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

function NotificationsButton({ className }: { className?: string }) {
  const [count, setCount] = useState(0)

  // La campana muestra los avisos del sistema que aún no se leen.
  useEffect(() => {
    let cancelled = false
    notificationService
      .list()
      .then((rows) => {
        if (!cancelled) setCount(rows.filter((n) => !n.readAt).length)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Link
      href="/notificaciones"
      className={cn(
        "relative inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.97]",
        className
      )}
      aria-label={`Notificaciones (${count} sin leer)`}
      title="Notificaciones"
    >
      <Bell className="size-[18px]" />
      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold tabular-nums text-primary-foreground ring-2 ring-background">
          {count}
        </span>
      )}
    </Link>
  )
}

function ActionNotice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-xl bg-primary/10 px-4 py-3 text-sm text-foreground animate-in fade-in slide-in-from-top-1 duration-200"
    >
      <span className="flex items-center gap-2.5">
        <CheckCircle2 className="size-4 shrink-0 text-primary" />
        {message}
      </span>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
      >
        Cerrar
      </button>
    </div>
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

const TIMELINE_TONE: Record<AppointmentStatus, string> = {
  [AppointmentStatus.CONFIRMED]: "bg-primary text-primary-foreground hover:bg-primary/90",
  [AppointmentStatus.PENDING]:
    "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300 hover:bg-amber-200/70 dark:bg-amber-500/20 dark:text-amber-100 dark:ring-amber-500/40",
  [AppointmentStatus.COMPLETED]: "bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/25",
  [AppointmentStatus.NO_SHOW]: "bg-muted-foreground/15 text-muted-foreground hover:bg-muted-foreground/25",
  [AppointmentStatus.CANCELLED]: "hidden",
}

/**
 * La jornada como una barra: cada cita ocupa su hora real, los huecos libres se
 * ven a simple vista y la línea de "ahora" avanza sola.
 */
function DayTimeline({
  appointments,
  patientById,
  now,
  highlightId,
  onSelect,
}: {
  appointments: Appointment[]
  patientById: Map<string, Patient>
  now: Date | null
  highlightId?: string
  onSelect: (apt: Appointment) => void
}) {
  const visible = appointments.filter((apt) => apt.status !== AppointmentStatus.CANCELLED)

  const startHour = Math.min(8, ...visible.map((apt) => new Date(apt.startTime).getHours()))
  const endHour = Math.max(
    20,
    ...visible.map((apt) => {
      const end = getEndTime(apt)
      return end.getHours() + (end.getMinutes() > 0 ? 1 : 0)
    })
  )
  const span = endHour - startHour
  const toPct = (d: Date) =>
    Math.min(100, Math.max(0, ((d.getHours() + d.getMinutes() / 60 - startHour) / span) * 100))

  const nowPct = now ? toPct(now) : null
  const hourMarks: number[] = []
  for (let h = startHour + (startHour % 2); h <= endHour; h += 2) hourMarks.push(h)

  return (
    <div className="@container space-y-2">
      <div className="relative h-12 overflow-hidden rounded-xl bg-muted/60">
        {/* Tiempo transcurrido, apenas sombreado */}
        {nowPct !== null && (
          <div
            className="absolute inset-y-0 left-0 bg-foreground/[0.035]"
            style={{ width: `${nowPct}%` }}
            aria-hidden="true"
          />
        )}

        {visible.map((apt) => {
          const start = new Date(apt.startTime)
          const left = toPct(start)
          const width = Math.max(toPct(getEndTime(apt)) - left, 3)
          const patientName = patientById.get(apt.patientId)?.name ?? "Paciente"

          return (
            <button
              key={apt.id}
              type="button"
              onClick={() => onSelect(apt)}
              title={`${formatAppointmentTime(start)} · ${patientName} · ${STATUS_META[apt.status].label}`}
              aria-label={`${formatAppointmentTime(start)}, ${patientName}, ${STATUS_META[apt.status].label}`}
              className={cn(
                "absolute inset-y-1.5 flex items-center overflow-hidden rounded-lg px-2 text-left text-[11px] font-medium transition-[background-color,transform] duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                TIMELINE_TONE[apt.status],
                apt.id === highlightId && "outline-2 outline-offset-2 outline-primary"
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              <span className="truncate">{patientName.split(" ")[0]}</span>
            </button>
          )
        })}

        {nowPct !== null && nowPct > 0 && nowPct < 100 && (
          <div
            className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground"
            style={{ left: `${nowPct}%` }}
            aria-hidden="true"
          >
            <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full bg-foreground" />
          </div>
        )}
      </div>

      <div className="relative h-4 text-[10px] tabular-nums text-muted-foreground" aria-hidden="true">
        {hourMarks.map((h) => (
          <span
            key={h}
            className={cn(
              "absolute whitespace-nowrap",
              h === startHour ? "" : h === endHour ? "-translate-x-full" : "-translate-x-1/2",
              // En anchos angostos, una etiqueta cada 4 h para que no se encimen
              (h - hourMarks[0]) % 4 !== 0 && "hidden @lg:inline"
            )}
            style={{ left: `${((h - startHour) / span) * 100}%` }}
          >
            {formatHourLabel(h)}
          </span>
        ))}
      </div>
    </div>
  )
}

type AgendaFilter = "all" | "confirmed" | "pending"

const FILTER_EMPTY_COPY: Record<AgendaFilter, string> = {
  all: "No hay citas este día",
  confirmed: "No hay citas confirmadas este día",
  pending: "No hay citas por confirmar este día",
}

type SessionUser = ReturnType<typeof useSession>["user"]

function PsychologistDashboardView({ user }: { user: SessionUser }) {
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>("all")
  const [activeSessionAppointment, setActiveSessionAppointment] = useState<Appointment | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  // Una respuesta a la vez: evita aceptar dos veces con doble clic.
  const [answeringRequestId, setAnsweringRequestId] = useState<string | null>(null)
  const listRef = useRef<HTMLElement>(null)

  const today = useMemo(() => new Date(), [])
  const fromToday = useMemo(() => startOfDay(today), [today])
  const toNextDays = useMemo(() => new Date(today.getTime() + 30 * DAY), [today])

  const { data: appointments = [], refetch: refetchAppointments } = useQuery({
    queryKey: ["appointments", "dashboard", fromToday.toISOString(), toNextDays.toISOString()],
    queryFn: () =>
      appointmentService.list({ from: fromToday, to: toNextDays, limit: 200 }),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const { data: patients = [] } = useQuery({
    queryKey: ["patients", "list", 100],
    queryFn: () => patientService.list({ limit: 100 }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const patientById = useMemo(
    () => new Map(patients.map((patient) => [patient.id, patient])),
    [patients],
  )

  const { data: pendingRequests = [], refetch: refetchRequests } = useQuery({
    queryKey: ["appointment-requests", AppointmentRequestStatus.PENDING],
    queryFn: () => appointmentRequestService.list(AppointmentRequestStatus.PENDING),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

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
  const focusPatient = focusAppointment ? patientById.get(focusAppointment.patientId) : undefined
  // Sesiones que ya terminaron pero siguen abiertas: falta registrar asistencia.
  const unregisteredToday = openToday.filter((apt) => getEndTime(apt) <= clock)

  const tomorrow = new Date(today.getTime() + DAY)
  const tomorrowAppointments = appointmentsOn(tomorrow).filter(isOpenAppointment)

  const todayConfirmed = todayAppointments.filter((a) => a.status === AppointmentStatus.CONFIRMED).length
  const todayPending = todayAppointments.filter((a) => a.status === AppointmentStatus.PENDING).length
  const lastOpenToday = openToday[openToday.length - 1]

  // Cola de confirmación: pendientes de hoy en adelante.
  const pendingQueue = useMemo(
    () =>
      appointments
        .filter(
          (apt) =>
            apt.status === AppointmentStatus.PENDING &&
            new Date(apt.startTime) >= startOfDay(today)
        )
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .slice(0, 4),
    [appointments, today]
  )

  // Lista: el día elegido en el calendario (hoy por defecto)
  const isViewingToday = isSameDay(selectedCalendarDate, today)
  const dayAppointments = appointmentsOn(selectedCalendarDate)
  const dayConfirmed = dayAppointments.filter((a) => a.status === AppointmentStatus.CONFIRMED).length
  const dayPending = dayAppointments.filter((a) => a.status === AppointmentStatus.PENDING).length
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

  // Mini-calendario mensual: cálculo de días de la cuadrícula
  const monthDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    // Lunes como inicio (0=Lu ... 6=Do)
    const startDayIndex = (firstDay.getDay() + 6) % 7
    const prevMonthLastDay = new Date(year, month, 0).getDate()

    const buildDay = (d: Date, isCurrentMonth: boolean) => ({
      date: d,
      isCurrentMonth,
      hasAppointments: appointments.some(
        (a) => a.status !== AppointmentStatus.CANCELLED && isSameDay(new Date(a.startTime), d)
      ),
      isToday: isSameDay(d, today),
      isSelected: isSameDay(d, selectedCalendarDate),
    })

    const days: ReturnType<typeof buildDay>[] = []

    for (let i = startDayIndex - 1; i >= 0; i--) {
      days.push(buildDay(new Date(year, month - 1, prevMonthLastDay - i), false))
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(buildDay(new Date(year, month, i), true))
    }
    // Rellenar días del mes siguiente hasta completar múltiplo de 7
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      days.push(buildDay(new Date(year, month + 1, i), false))
    }

    return days
  }, [calendarMonth, appointments, today, selectedCalendarDate])

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const selectDay = (day: Date) => {
    setSelectedCalendarDate(day)
    setCalendarMonth(new Date(day.getFullYear(), day.getMonth(), 1))
    setAgendaFilter("all")
  }

  const scrollToList = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    listRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
  }

  const showPendingToday = () => {
    selectDay(today)
    setAgendaFilter("pending")
    scrollToList()
  }

  const showNotice = (message: string) => {
    setActionNotice(message)
    setTimeout(() => setActionNotice(null), 3500)
  }

  const handleRegisterAttendance = async (aptId: string) => {
    try {
      const updated = await appointmentService.changeStatus(aptId, AppointmentStatus.COMPLETED)
      await refetchAppointments()
      setActiveSessionAppointment(null)
      showNotice("Asistencia registrada. La sesión quedó como completada.")
    } catch {
      showNotice("No se pudo registrar la asistencia. Intenta de nuevo.")
    }
  }

  const handleConfirmAppointment = async (aptId: string) => {
    try {
      const updated = await appointmentService.changeStatus(aptId, AppointmentStatus.CONFIRMED)
      await refetchAppointments()
      setActiveSessionAppointment(null)
      const name = patientById.get(appointments.find((a) => a.id === aptId)?.patientId ?? "")?.name
      showNotice(name ? `Cita con ${name} confirmada.` : "Cita confirmada.")
    } catch {
      showNotice("No se pudo confirmar la cita. Intenta de nuevo.")
    }
  }

  const handleAnswerRequest = async (requestId: string, accept: boolean) => {
    if (answeringRequestId) return
    setAnsweringRequestId(requestId)
    const name = patientById.get(pendingRequests.find((r) => r.id === requestId)?.patientId ?? "")?.name
    try {
      if (accept) {
        await appointmentRequestService.accept(requestId)
        await refetchAppointments()
      } else {
        await appointmentRequestService.reject(requestId)
      }
      await refetchRequests()
      const verb = accept ? "con" : "de"
      const who = name ? ` ${verb} ${name}` : ""
      showNotice(accept ? `Cita${who} agendada y confirmada.` : `Solicitud${who} rechazada.`)
    } catch (error) {
      await refetchRequests()
      showNotice(error instanceof Error ? error.message : "No se pudo responder la solicitud.")
    } finally {
      setAnsweringRequestId(null)
    }
  }

  const formattedMonth = capitalize(
    calendarMonth.toLocaleDateString("es-MX", { month: "long", year: "numeric" })
  )

  const formattedTodayHeader = capitalize(
    today.toLocaleDateString("es-MX", {
      weekday: "long",
      day: "numeric",
      month: "long",
    })
  )

  const filters: { value: AgendaFilter; label: string; count: number }[] = [
    { value: "all", label: "Todas", count: dayAppointments.length },
    { value: "confirmed", label: "Confirmadas", count: dayConfirmed },
    { value: "pending", label: "Por confirmar", count: dayPending },
  ]

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-6xl space-y-8" aria-busy="true">
        <div className="h-[86px] border-b border-border/60" />
        <div className="h-[66px] rounded-2xl border border-border/60 bg-card" />
        <div className="h-[420px] rounded-xl border border-border/70 bg-card" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Encabezado: saludo + acciones principales */}
      <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{formattedTodayHeader}</p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {psychologistGreeting}
          </h1>
        </div>

        {/* En móvil, notificaciones y reportes ya viven en la barra inferior */}
        <div className="flex items-center gap-2">
          <NotificationsButton className="hidden sm:inline-flex" />
          <Button asChild variant="ghost" className="hidden text-muted-foreground sm:inline-flex">
            <Link href="/reportes">
              <FileText />
              Generar reporte
            </Link>
          </Button>
          <Button asChild className="flex-1 sm:flex-none">
            <Link href="/agenda/nueva">
              <Plus />
              Nueva cita
            </Link>
          </Button>
        </div>
      </header>

      {actionNotice && (
        <ActionNotice message={actionNotice} onClose={() => setActionNotice(null)} />
      )}

      {/* TU DÍA: qué sigue + la jornada completa de un vistazo */}
      <section aria-label="Tu día" className="@container overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-5 p-5 sm:p-6 @3xl:flex-row @3xl:items-center @3xl:justify-between">
          {focusAppointment ? (
            <>
              <div className="min-w-0 space-y-3">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-primary">
                  <LiveDot pulsing={Boolean(currentAppointment)} />
                  <span className="whitespace-nowrap">{currentAppointment ? "En curso" : "Siguiente cita"}</span>
                  {now && (
                    <span className="whitespace-nowrap font-normal text-muted-foreground">
                      ·{" "}
                      {currentAppointment
                        ? `termina ${formatRelative(getEndTime(currentAppointment), now)}`
                        : formatRelative(new Date(focusAppointment.startTime), now)}
                    </span>
                  )}
                </p>

                <div className="flex items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {getInitials(focusPatient?.name ?? "Paciente")}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xl font-semibold tracking-tight text-foreground">
                      {focusPatient?.name ?? "Paciente"}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
                      <span className="tabular-nums">
                        {formatAppointmentTime(new Date(focusAppointment.startTime))} –{" "}
                        {formatAppointmentTime(getEndTime(focusAppointment))}
                      </span>
                      <span aria-hidden="true">·</span>
                      <ModalityLabel modality={focusAppointment.modality} />
                      {focusAppointment.reason && (
                        <>
                          <span aria-hidden="true" className="hidden sm:inline">·</span>
                          <span className="hidden truncate sm:inline">{focusAppointment.reason}</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {focusAppointment.status === AppointmentStatus.PENDING && (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Esta cita aún no está confirmada.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 @3xl:shrink-0">
                {focusAppointment.modality === AppointmentModality.VIRTUAL && (
                  <Button
                    variant="outline"
                    onClick={() => window.open("https://meet.google.com/psi-diag-ses", "_blank")}
                  >
                    <Video />
                    Videollamada
                  </Button>
                )}
                <Button asChild variant="outline">
                  <Link href={`/pacientes/${focusAppointment.patientId}`}>Expediente</Link>
                </Button>
                <Button onClick={() => setActiveSessionAppointment(focusAppointment)}>
                  {currentAppointment ? "Registrar sesión" : "Iniciar sesión"}
                </Button>
              </div>
            </>
          ) : unregisteredToday.length > 0 ? (
            <>
              <div className="min-w-0 space-y-1.5">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
                  Falta registrar asistencia
                </p>
                <p className="text-xl font-semibold tracking-tight text-foreground">
                  {unregisteredToday.length === 1
                    ? "Tienes 1 sesión de hoy sin registrar"
                    : `Tienes ${unregisteredToday.length} sesiones de hoy sin registrar`}
                </p>
                <p className="text-sm text-muted-foreground">
                  Toca cada bloque de la línea del día, o empieza por la primera.
                </p>
              </div>
              <Button
                className="@3xl:shrink-0"
                onClick={() => setActiveSessionAppointment(unregisteredToday[0])}
              >
                Registrar {patientById.get(unregisteredToday[0].patientId)?.name?.split(" ")[0] ?? "sesión"}
              </Button>
            </>
          ) : (
            <div className="space-y-1.5">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CheckCircle2 className="size-4 text-primary" />
                Día completado
              </p>
              <p className="text-xl font-semibold tracking-tight text-foreground">
                No te quedan citas por hoy
              </p>
              <p className="text-sm text-muted-foreground">
                {tomorrowAppointments.length > 0
                  ? `Mañana: ${tomorrowAppointments.length} ${tomorrowAppointments.length === 1 ? "cita" : "citas"}, la primera a las ${formatAppointmentTime(new Date(tomorrowAppointments[0].startTime))}`
                  : "Mañana no tienes citas programadas."}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4 border-t border-border bg-muted/20 px-5 py-5 sm:px-6">
          <DayTimeline
            appointments={todayAppointments}
            patientById={patientById}
            now={now}
            highlightId={focusAppointment?.id}
            onSelect={setActiveSessionAppointment}
          />

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
            <p className="flex flex-wrap items-center gap-x-1.5 text-muted-foreground">
              <span>
                <span className="font-semibold tabular-nums text-foreground">{todayAppointments.length}</span>{" "}
                {todayAppointments.length === 1 ? "cita" : "citas"} hoy
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <span className="font-semibold tabular-nums text-foreground">{todayConfirmed}</span>{" "}
                {todayConfirmed === 1 ? "confirmada" : "confirmadas"}
              </span>
              {todayPending > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={showPendingToday}
                    className="rounded-md font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400"
                  >
                    {todayPending} por confirmar
                  </button>
                </>
              )}
              {lastOpenToday && getEndTime(lastOpenToday) > clock && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Libre desde las {formatAppointmentTime(getEndTime(lastOpenToday))}</span>
                </>
              )}
            </p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-primary" />
                Confirmada
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-amber-300 dark:bg-amber-500/60" />
                Por confirmar
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2 rounded-sm bg-muted-foreground/30" />
                Completada
              </span>
            </div>
          </div>
        </div>
      </section>

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

            {/* Control segmentado: la selección se marca con superficie, no con color */}
            <div className="inline-flex self-start rounded-xl bg-muted p-1 @lg:self-auto">
              {filters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setAgendaFilter(filter.value)}
                  aria-pressed={agendaFilter === filter.value}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150",
                    agendaFilter === filter.value
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {filter.label}
                  <span className="ml-1.5 tabular-nums text-muted-foreground">{filter.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {filteredDayAppointments.length > 0 ? (
              <ul className="divide-y divide-border">
                {filteredDayAppointments.map((apt) => {
                  const patient = patientById.get(apt.patientId)
                  const patientName = patient?.name || "Paciente"
                  const isNext = isViewingToday && apt.id === focusAppointment?.id
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
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                Siguiente
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
              <div className="space-y-3 px-6 py-12 text-center">
                <p className="text-sm font-medium text-foreground">{FILTER_EMPTY_COPY[agendaFilter]}</p>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  Elige otro día en el calendario o programa una nueva sesión.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-1">
                  <Link href="/agenda/nueva">
                    <Plus />
                    Nueva cita
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        <div className="grid content-start gap-6 sm:grid-cols-2 xl:grid-cols-1">
          {/* Mini-calendario: tocar un día muestra sus citas en la lista */}
          <aside className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold tracking-tight text-foreground">{formattedMonth}</span>
              <div className="flex items-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handlePrevMonth}
                  aria-label="Mes anterior"
                  className="text-muted-foreground"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleNextMonth}
                  aria-label="Mes siguiente"
                  className="text-muted-foreground"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
              {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-1 text-center">
              {monthDays.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectDay(item.date)}
                  aria-label={item.date.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
                  aria-current={item.isToday ? "date" : undefined}
                  aria-pressed={item.isSelected}
                  className={cn(
                    "relative mx-auto flex size-8 items-center justify-center rounded-full text-xs tabular-nums transition-colors active:scale-95",
                    !item.isCurrentMonth && "text-muted-foreground/40",
                    item.isCurrentMonth && !item.isToday && "text-foreground hover:bg-muted",
                    item.isSelected && !item.isToday && "bg-primary/10 font-semibold text-primary hover:bg-primary/15",
                    item.isToday && "bg-primary font-semibold text-primary-foreground",
                    item.isToday && !item.isSelected && "ring-2 ring-primary/30 ring-offset-2 ring-offset-card"
                  )}
                >
                  {item.date.getDate()}
                  {item.hasAppointments && (
                    <span
                      className={cn(
                        "absolute bottom-0.5 size-1 rounded-full",
                        item.isToday ? "bg-primary-foreground" : "bg-primary"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>

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

          {/* Por confirmar: lo que necesita una respuesta, con la acción a la mano */}
          <aside className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Por confirmar</h2>
              {pendingRequests.length + pendingQueue.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">
                  {pendingRequests.length + pendingQueue.length}
                </span>
              )}
            </div>

            {pendingRequests.length + pendingQueue.length > 0 ? (
              <ul className="space-y-1">
                {pendingRequests.map((request) => {
                  const start = new Date(request.startTime)
                  const patientName = patientById.get(request.patientId)?.name ?? "Paciente"
                  return (
                    <li
                      key={request.id}
                      className="-mx-2 flex items-center gap-2 rounded-xl px-2 py-2 animate-in fade-in duration-200"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{patientName}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          Solicitud · {isSameDay(start, today) ? "Hoy" : capitalize(formatShortDate(start))} ·{" "}
                          {formatAppointmentTime(start)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={answeringRequestId !== null}
                        onClick={() => handleAnswerRequest(request.id, false)}
                      >
                        Rechazar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={answeringRequestId !== null}
                        onClick={() => handleAnswerRequest(request.id, true)}
                      >
                        Aceptar
                      </Button>
                    </li>
                  )
                })}
                {pendingQueue.map((apt) => {
                  const start = new Date(apt.startTime)
          const patientName = patientById.get(apt.patientId)?.name ?? "Paciente"
                  return (
                    <li
                      key={apt.id}
                      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 animate-in fade-in duration-200"
                    >
                      <button
                        type="button"
                        onClick={() => selectDay(start)}
                        className="min-w-0 flex-1 text-left"
                        title="Ver ese día"
                      >
                        <p className="truncate text-sm font-medium text-foreground">{patientName}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">
                          {isSameDay(start, today) ? "Hoy" : capitalize(formatShortDate(start))} ·{" "}
                          {formatAppointmentTime(start)}
                        </p>
                      </button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleConfirmAppointment(apt.id)}
                      >
                        Confirmar
                      </Button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-primary" />
                Todas tus próximas citas están confirmadas.
              </p>
            )}
          </aside>
        </div>
      </div>

      {/* Iniciar sesión / registrar asistencia */}
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
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null)
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

  // Solicitudes que aún importan: las que esperan respuesta y los rechazos de fechas por venir.
  const openRequests = useMemo(() => {
    if (!clock) return []
    return requests.filter(
      (r) =>
        r.status === AppointmentRequestStatus.PENDING ||
        (r.status === AppointmentRequestStatus.REJECTED && new Date(r.startTime) > clock),
    )
  }, [requests, clock])

  const handleCancelRequest = async (requestId: string) => {
    try {
      const updated = await appointmentRequestService.cancel(requestId)
      setRequests((prev) => prev.map((r) => (r.id === requestId ? updated : r)))
      setFeedbackNotice("Retiraste tu solicitud.")
    } catch (error) {
      setFeedbackNotice(error instanceof Error ? error.message : "No se pudo retirar la solicitud.")
    } finally {
      setTimeout(() => setFeedbackNotice(null), 4000)
    }
  }

  const handleCancelAppointment = async (aptId: string) => {
    const finalReason = cancellationReason === "Otro" ? (otherReason || "Sin especificar") : cancellationReason
    setIsCancelling(true)
    try {
      const updated = await appointmentService.cancel(aptId, finalReason)
      setAppointments((prev) => prev.map((apt) => (apt.id === aptId ? updated : apt)))
      setCancelModalOpen(false)
      setFeedbackNotice("Tu cita fue cancelada y tu psicólogo/a ya fue notificado/a.")
    } catch (error) {
      setFeedbackNotice(error instanceof Error ? error.message : "No se pudo cancelar la cita.")
    } finally {
      setIsCancelling(false)
      setTimeout(() => setFeedbackNotice(null), 4000)
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
        <div className="h-[86px] border-b border-border/60" />
        <div className="h-[66px] rounded-2xl border border-border/60 bg-card" />
        <div className="h-[420px] rounded-xl border border-border/70 bg-card" />
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
          <p className="text-sm text-muted-foreground">
            Aquí tienes tu próxima sesión y lo que necesitas para llegar con todo listo.
          </p>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <NotificationsButton />
          <Button asChild>
            <Link href="/agenda/nueva">
              <Plus />
              Solicitar cita
            </Link>
          </Button>
        </div>
      </header>

      {feedbackNotice && (
        <ActionNotice message={feedbackNotice} onClose={() => setFeedbackNotice(null)} />
      )}

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
                  : "Paseo de la Reforma #450, Piso 3, Consultorio 3B, CDMX."}
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
              Reagendar
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
                Elige el día y horario que mejor te acomode para tu siguiente sesión.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/agenda/nueva">
                <Plus />
                Solicitar cita
              </Link>
            </Button>
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

      {/* Reagendar */}
      {nextAppointment && (
        <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold tracking-tight">Reagendar cita</DialogTitle>
              <DialogDescription>
                Tu cita actual es el {formatHeroDate(nextAppointment.startTime).toLowerCase()} a las{" "}
                {formatAppointmentTime(new Date(nextAppointment.startTime))}. Podrás elegir un nuevo
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
                {formatHeroDate(nextAppointment.startTime)} · {formatAppointmentTime(new Date(nextAppointment.startTime))}.
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
