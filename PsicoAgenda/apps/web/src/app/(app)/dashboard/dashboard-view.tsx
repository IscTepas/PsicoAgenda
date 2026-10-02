"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  CalendarDays,
  Clock,
  Video,
  MapPin,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Calendar,
  CalendarSync,
  CalendarCheck,
  CalendarPlus,
  HeartHandshake,
  XCircle,
  ExternalLink,
  UserCheck,
  User,
  Phone,
  Mail,
  ShieldCheck,
  Sparkles,
  Bell,
  UserPlus,
} from "lucide-react"
import {
  AppointmentStatus,
  AppointmentModality,
  AttendanceStatus,
  UserRole,
  type Appointment,
  type Patient,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "../components/page-header"
import { useSession } from "@/lib/use-session"
import { cn } from "@/lib/utils"
import {
  MOCK_APPOINTMENTS,
  MOCK_PATIENTS,
  MOCK_PSYCHOLOGIST,
  formatAppointmentTime,
  formatShortDate,
  getPatientById,
  getPatientForUser,
  getLatestHomeworkForPatient,
} from "@/lib/mock-data"

function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (name[0] ?? "P").toUpperCase()
}

function getStatusBadge(status: AppointmentStatus) {
  switch (status) {
    case AppointmentStatus.CONFIRMED:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-3" />
          Confirmada
        </span>
      )
    case AppointmentStatus.PENDING:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          <Clock className="size-3" />
          Por confirmar
        </span>
      )
    case AppointmentStatus.COMPLETED:
      return (
        <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          Completada
        </span>
      )
    case AppointmentStatus.CANCELLED:
      return (
        <span className="inline-flex items-center rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
          Cancelada
        </span>
      )
    case AppointmentStatus.NO_SHOW:
      return (
        <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          No asistió
        </span>
      )
  }
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  )
}

function getPsychologistStatusBadge(status: AppointmentStatus) {
  switch (status) {
    case AppointmentStatus.CONFIRMED:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-semibold tracking-tight shadow-2xs">
          <CheckCircle2 className="size-3 text-primary" />
          Confirmada
        </span>
      )
    case AppointmentStatus.PENDING:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 px-2.5 py-0.5 text-[11px] font-medium shadow-2xs">
          <Clock className="size-3 text-amber-600 dark:text-amber-400" />
          Pendiente
        </span>
      )
    case AppointmentStatus.COMPLETED:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 text-muted-foreground px-2.5 py-0.5 text-[11px] font-medium">
          <CheckCircle2 className="size-3 text-muted-foreground" />
          Completada
        </span>
      )
    case AppointmentStatus.CANCELLED:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 text-destructive px-2.5 py-0.5 text-[11px] font-medium line-through">
          <XCircle className="size-3" />
          Cancelada
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {status}
        </span>
      )
  }
}

function PsychologistDashboardView({ user }: { user: any }) {
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS)
  const [agendaFilter, setAgendaFilter] = useState<"all" | "confirmed" | "pending">("all")
  const [activeSessionAppointment, setActiveSessionAppointment] = useState<Appointment | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)

  // Mini-calendario state
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date())
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date())

  const today = useMemo(() => new Date(), [])

  // Nombre y saludo personalizado: "Hola, Psic. [Nombre]"
  const rawName = user?.name || MOCK_PSYCHOLOGIST.name
  const cleanName = rawName.replace(/^(Dra.|Dr.|Psic.|Lic.)s*/i, "")
  const psychologistGreeting = `Hola, Psic. ${cleanName}`

  // Citas de hoy exclusivamente
  const todayAppointments = useMemo(() => {
    return appointments
      .filter((apt) => isSameDay(new Date(apt.startTime), today))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [appointments, today])

  // Métricas rápidas
  const confirmedTodayCount = useMemo(() => {
    return todayAppointments.filter((apt) => apt.status === AppointmentStatus.CONFIRMED).length
  }, [todayAppointments])

  const pendingTodayCount = useMemo(() => {
    return todayAppointments.filter((apt) => apt.status === AppointmentStatus.PENDING).length
  }, [todayAppointments])

  const cancelledThisWeekCount = useMemo(() => {
    return appointments.filter((apt) => apt.status === AppointmentStatus.CANCELLED).length || 1
  }, [appointments])

  // Filtrado de citas de hoy
  const filteredTodayAppointments = useMemo(() => {
    if (agendaFilter === "confirmed") {
      return todayAppointments.filter((apt) => apt.status === AppointmentStatus.CONFIRMED)
    }
    if (agendaFilter === "pending") {
      return todayAppointments.filter((apt) => apt.status === AppointmentStatus.PENDING)
    }
    return todayAppointments
  }, [todayAppointments, agendaFilter])

  // Mini-calendario mensual: cálculo de días de la cuadrícula
  const monthDays = useMemo(() => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    
    // Lunes como inicio (0=Lu ... 6=Do)
    const startDayIndex = (firstDay.getDay() + 6) % 7
    const prevMonthLastDay = new Date(year, month, 0).getDate()
    
    const days: {
      date: Date
      isCurrentMonth: boolean
      hasAppointments: boolean
      isToday: boolean
      isSelected: boolean
    }[] = []
    
    // Días del mes previo
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLastDay - i)
      days.push({
        date: d,
        isCurrentMonth: false,
        hasAppointments: appointments.some((a) => isSameDay(new Date(a.startTime), d)),
        isToday: isSameDay(d, today),
        isSelected: isSameDay(d, selectedCalendarDate),
      })
    }
    
    // Días del mes actual
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i)
      days.push({
        date: d,
        isCurrentMonth: true,
        hasAppointments: appointments.some((a) => isSameDay(new Date(a.startTime), d)),
        isToday: isSameDay(d, today),
        isSelected: isSameDay(d, selectedCalendarDate),
      })
    }
    
    // Rellenar días del mes siguiente hasta completar múltiplo de 7
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      days.push({
        date: d,
        isCurrentMonth: false,
        hasAppointments: appointments.some((a) => isSameDay(new Date(a.startTime), d)),
        isToday: isSameDay(d, today),
        isSelected: isSameDay(d, selectedCalendarDate),
      })
    }
    
    return days
  }, [calendarMonth, appointments, today, selectedCalendarDate])

  const handlePrevMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleRegisterAttendance = (aptId: string) => {
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === aptId
          ? { ...apt, status: AppointmentStatus.COMPLETED }
          : apt
      )
    )
    setActionNotice("Asistencia registrada con éxito. La sesión fue completada.")
    setActiveSessionAppointment(null)
    setTimeout(() => setActionNotice(null), 3500)
  }

  const handleConfirmAppointment = (aptId: string) => {
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === aptId
          ? { ...apt, status: AppointmentStatus.CONFIRMED }
          : apt
      )
    )
    setActionNotice("Cita confirmada correctamente.")
    setActiveSessionAppointment(null)
    setTimeout(() => setActionNotice(null), 3500)
  }

  // Formato del mes para el mini-calendario (ej. "Octubre 2026")
  const monthLabel = calendarMonth.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  })
  const formattedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)

  // Formato de fecha para el subtítulo de la cabecera
  const formattedToday = today.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  const formattedTodayHeader = formattedToday.charAt(0).toUpperCase() + formattedToday.slice(1)

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. CABECERA (HEADER CON IDENTIDAD CLÍNICA) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-border/70">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-heading">
            {psychologistGreeting}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2">
            <span>{formattedTodayHeader}</span>
            <span className="opacity-40">•</span>
            <span className="font-medium text-primary">Panel de Práctica Clínica</span>
          </p>
        </div>

        {/* Campana de Notificaciones con Indicador Numérico y Foto de Perfil */}
        <div className="flex items-center gap-3">
          <Link
            href="/notificaciones"
            className="relative p-2.5 rounded-xl border border-border/80 bg-card text-foreground hover:bg-muted/70 hover:border-primary/40 transition-colors shadow-2xs"
            title="Notificaciones de citas y recordatorios"
            aria-label="Notificaciones"
          >
            <Bell className="size-5" />
            <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-xs ring-2 ring-background">
              3
            </span>
          </Link>

          <Link
            href="/perfil"
            className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border border-border/80 bg-card hover:bg-muted/60 hover:border-primary/40 transition-colors shadow-2xs group"
            title="Configuración de Perfil Clínico"
          >
            <div className="relative size-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20">
              {getInitials(rawName)}
              <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold leading-tight text-foreground group-hover:text-primary transition-colors truncate max-w-[120px]">
                Psic. {cleanName}
              </p>
              <p className="text-[10px] text-primary font-medium leading-none mt-0.5">
                En consulta
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* AVISO DE ACCIÓN (FEEDBACK) */}
      {actionNotice && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-xs text-foreground shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-primary" />
            <span className="font-medium">{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-primary hover:text-foreground text-xs px-2 py-0.5"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* 2. SECCIÓN DE ACCIONES RÁPIDAS (3 BOTONES PRINCIPALES DESTACADOS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Botón 1: + Nueva Cita (Verde primario base del sistema, como en el panel lateral) */}
        <Link
          href="/agenda/nueva"
          className="group flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-xs active:scale-[0.99]"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Plus className="size-4 shrink-0 stroke-[2.5]" />
              <span className="font-semibold text-sm tracking-tight">+ Nueva Cita</span>
            </div>
            <p className="text-xs text-primary-foreground/80">
              Agendar consulta en calendario
            </p>
          </div>
          <ChevronRight className="size-4 opacity-80 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {/* Botón 2: + Nuevo Paciente */}
        <Link
          href="/pacientes"
          className="group flex items-center justify-between p-4 rounded-xl border border-border/80 bg-card text-foreground hover:border-primary/40 hover:bg-primary/[0.03] transition-all shadow-2xs"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <UserPlus className="size-3.5 stroke-[2.2]" />
              </div>
              <span className="font-semibold text-sm tracking-tight group-hover:text-primary transition-colors">+ Nuevo Paciente</span>
            </div>
            <p className="text-xs text-muted-foreground pl-9.5">
              Registrar expediente clínico
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </Link>

        {/* Botón 3: Generar Reporte */}
        <Link
          href="/reportes"
          className="group flex items-center justify-between p-4 rounded-xl border border-border/80 bg-card text-foreground hover:border-primary/40 hover:bg-primary/[0.03] transition-all shadow-2xs"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <FileText className="size-3.5 stroke-[2.2]" />
              </div>
              <span className="font-semibold text-sm tracking-tight group-hover:text-primary transition-colors">Generar Reporte</span>
            </div>
            <p className="text-xs text-muted-foreground pl-9.5">
              Hojas de asistencia y métricas
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>

      {/* DISPOSICIÓN PRINCIPAL EN 2 COLUMNAS (IZQUIERDA Y DERECHA) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 3. COLUMNA PRINCIPAL (IZQUIERDA - PRÓXIMAS CITAS PROGRAMADAS PARA HOY) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/70">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight font-heading">
                  Próximas Citas (Hoy)
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md border border-primary/20 bg-primary/10 text-primary">
                  {todayAppointments.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Consultas agendadas exclusivamente para el día de hoy
              </p>
            </div>

            {/* Filtros rápidos: Todas, Confirmadas, Pendientes */}
            <div className="flex items-center rounded-lg border border-border/80 p-0.5 bg-muted/40 text-xs self-start sm:self-auto">
              <button
                onClick={() => setAgendaFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors",
                  agendaFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todas ({todayAppointments.length})
              </button>
              <button
                onClick={() => setAgendaFilter("confirmed")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors",
                  agendaFilter === "confirmed"
                    ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Confirmadas ({confirmedTodayCount})
              </button>
              <button
                onClick={() => setAgendaFilter("pending")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors",
                  agendaFilter === "pending"
                    ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Pendientes ({pendingTodayCount})
              </button>
            </div>
          </div>

          {/* LISTA DE TARJETAS DE CITAS DE HOY */}
          <div className="space-y-3">
            {filteredTodayAppointments.map((apt) => {
              const patient = getPatientById(apt.patientId)
              const patientName = patient?.name || "Paciente"
              const startTime = formatAppointmentTime(new Date(apt.startTime))
              const endTime = formatAppointmentTime(
                new Date(new Date(apt.startTime).getTime() + (apt.durationMinutes || 50) * 60 * 1000)
              )

              return (
                <div
                  key={apt.id}
                  className="rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xs shadow-2xs space-y-3"
                >
                  {/* Fila superior: Hora, Modalidad y Estado de la cita */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary font-mono text-xs font-semibold border border-primary/20">
                        <Clock className="size-3 text-primary" />
                        {startTime} – {endTime}
                      </span>

                      {apt.modality === AppointmentModality.VIRTUAL ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-0.5 rounded-md border border-border/60 bg-muted/40">
                          <Video className="size-3 text-primary" />
                          Virtual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground px-2 py-0.5 rounded-md border border-border/60 bg-muted/40">
                          <MapPin className="size-3 text-primary" />
                          Presencial
                        </span>
                      )}
                    </div>

                    {/* Estado de la cita con color primario base */}
                    <div>{getPsychologistStatusBadge(apt.status)}</div>
                  </div>

                  {/* Fila central: Nombre del Paciente y Motivo de Consulta */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary shrink-0">
                        {getInitials(patientName)}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground">
                            {patientName}
                          </p>
                          {patient?.isMinor && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded border border-border/70 text-muted-foreground bg-muted/50">
                              Menor de edad
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {apt.reason || "Sesión de terapia clínica programada"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fila inferior: Botones de acceso rápido "Ver Expediente" y "Iniciar Sesión" */}
                  <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 text-xs font-medium border-border/80 text-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/[0.04] rounded-lg"
                    >
                      <Link href={`/pacientes/${apt.patientId}`}>
                        <FileText className="mr-1.5 size-3.5 text-muted-foreground" />
                        Ver Expediente
                      </Link>
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setActiveSessionAppointment(apt)}
                        className="h-8 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg shadow-xs active:scale-[0.98]"
                      >
                        <CheckCircle2 className="mr-1.5 size-3.5" />
                        Iniciar Sesión
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}

            {filteredTodayAppointments.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/80 p-8 text-center space-y-2.5 bg-card">
                <CalendarDays className="size-8 mx-auto text-muted-foreground stroke-1" />
                <p className="text-sm font-semibold text-foreground">
                  No hay citas {agendaFilter !== "all" ? `${agendaFilter}s` : ""} programadas para hoy
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Puedes revisar las demás citas en la agenda o registrar una nueva sesión clínica.
                </p>
                <Button
                  size="sm"
                  asChild
                  className="mt-2 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                >
                  <Link href="/agenda/nueva">+ Nueva Cita</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 4. COLUMNA SECUNDARIA (DERECHA - MINI-CALENDARIO Y MÉTRICAS RÁPIDAS) */}
        <div className="space-y-4">
          {/* MINI-CALENDARIO MENSUAL CON EL COLOR DEL PANEL LATERAL (PRIMARY) */}
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3.5 shadow-2xs">
            {/* Cabecera del mini-calendario */}
            <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
              <span className="font-bold text-xs sm:text-sm text-foreground tracking-tight">
                {formattedMonth}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-md border border-border/70 hover:bg-muted/70 text-muted-foreground hover:text-foreground"
                  title="Mes anterior"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-md border border-border/70 hover:bg-muted/70 text-muted-foreground hover:text-foreground"
                  title="Mes siguiente"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Días de la semana abreviados */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-muted-foreground uppercase">
              <span>Lu</span>
              <span>Ma</span>
              <span>Mi</span>
              <span>Ju</span>
              <span>Vi</span>
              <span>Sá</span>
              <span>Do</span>
            </div>

            {/* Matriz de días */}
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {monthDays.map((item, idx) => {
                const dayNumber = item.date.getDate()
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedCalendarDate(item.date)}
                    className={cn(
                      "h-8 rounded-md flex flex-col items-center justify-center relative transition-colors text-[11px]",
                      !item.isCurrentMonth && "text-muted-foreground/40",
                      item.isCurrentMonth && "text-foreground hover:bg-muted/60",
                      item.isToday && "bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow-xs",
                      item.isSelected && !item.isToday && "ring-2 ring-primary font-semibold text-primary"
                    )}
                  >
                    <span>{dayNumber}</span>
                    {/* Indicador de citas en el día */}
                    {item.hasAppointments && (
                      <span
                        className={cn(
                          "size-1 rounded-full absolute bottom-1",
                          item.isToday
                            ? "bg-primary-foreground"
                            : "bg-primary"
                        )}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Pie del calendario con leyenda y enlace directo a la agenda completa */}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary inline-block" />
                Días con citas
              </span>
              <Link
                href="/agenda"
                className="font-medium text-primary hover:underline flex items-center gap-1"
              >
                <span>Ver agenda</span>
                <ChevronRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* BLOQUE DE MÉTRICAS RÁPIDAS CON EL COLOR BASE PRIMARY */}
          <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground font-heading flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary inline-block" />
                Métricas Rápidas
              </h3>
              <span className="text-[10px] text-muted-foreground font-mono">
                Semana en curso
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-2">
                  <CalendarDays className="size-3.5 text-primary" />
                  Citas hoy
                </span>
                <span className="font-bold text-foreground text-sm tabular-nums">
                  {todayAppointments.length}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  Confirmadas hoy
                </span>
                <span className="font-bold text-primary text-sm tabular-nums">
                  {confirmedTodayCount}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
                  Pendientes hoy
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-400 text-sm tabular-nums">
                  {pendingTodayCount}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-muted-foreground flex items-center gap-2">
                  <XCircle className="size-3.5 text-red-500 dark:text-red-400" />
                  Canceladas esta semana
                </span>
                <span className="font-bold text-red-600 dark:text-red-400 text-sm tabular-nums">
                  {cancelledThisWeekCount}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Users className="size-3.5 text-primary" />
                  Pacientes activos
                </span>
                <span className="font-bold text-foreground text-sm tabular-nums">
                  {MOCK_PATIENTS.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DIALOG: INICIAR SESIÓN / REGISTRAR ASISTENCIA */}
      {activeSessionAppointment && (
        <Dialog
          open={Boolean(activeSessionAppointment)}
          onOpenChange={(open) => {
            if (!open) setActiveSessionAppointment(null)
          }}
        >
          <DialogContent className="max-w-md border-border/80 bg-background text-foreground">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="size-5 text-primary" />
                <span>Gestión de Sesión Clínica</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Paciente: {getPatientById(activeSessionAppointment.patientId)?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Horario programado:</span>
                  <span className="font-mono font-semibold">
                    {formatAppointmentTime(new Date(activeSessionAppointment.startTime))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Modalidad:</span>
                  <span className="font-medium capitalize">
                    {activeSessionAppointment.modality === AppointmentModality.VIRTUAL ? "Videollamada" : "Presencial"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Motivo:</span>
                  <span className="font-medium truncate max-w-[200px]">
                    {activeSessionAppointment.reason || "Sin especificar"}
                  </span>
                </div>
              </div>

              {activeSessionAppointment.modality === AppointmentModality.VIRTUAL && (
                <div className="p-3 rounded-lg border border-primary/25 bg-primary/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="size-4 text-primary" />
                    <span className="font-medium text-xs">Enlace de videollamada</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => {
                      window.open("https://meet.google.com/psi-diag-ses", "_blank")
                    }}
                  >
                    Unirse ahora
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setActiveSessionAppointment(null)}
              >
                Cerrar
              </Button>

              {activeSessionAppointment.status === AppointmentStatus.PENDING && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-amber-400 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300"
                  onClick={() => handleConfirmAppointment(activeSessionAppointment.id)}
                >
                  Confirmar Cita
                </Button>
              )}

              <Button
                size="sm"
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                onClick={() => handleRegisterAttendance(activeSessionAppointment.id)}
              >
                Registrar Asistencia
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

function PatientDashboardView({ user }: { user: any }) {
  const patient = getPatientForUser(user)
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS)
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null)

  // Modales
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancellationReason, setCancellationReason] = useState("Inconveniente de horario o imprevisto")
  const [otherReason, setOtherReason] = useState("")

  // Nombre amigable para el saludo: "Hola, [Nombre]"
  const cleanFirstName = patient?.name?.trim().split(" ")[0] || "Paciente"
  const friendlyGreeting = `Hola, ${cleanFirstName}`

  // Citas del paciente
  const patientAppointments = useMemo(() => {
    return appointments.filter((a) => a.patientId === patient.id)
  }, [appointments, patient.id])

  const now = useMemo(() => new Date(), [])

  // Próximas citas (no canceladas ni completadas)
  const upcomingAppointments = useMemo(() => {
    return patientAppointments
      .filter((a) => a.status !== AppointmentStatus.COMPLETED && a.status !== AppointmentStatus.CANCELLED)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [patientAppointments])

  // Cita más próxima (Héroe)
  const nextAppointment = upcomingAppointments[0] || null

  // Citas pasadas ("Mis últimas citas")
  const pastAppointments = useMemo(() => {
    return patientAppointments
      .filter((a) => a.status === AppointmentStatus.COMPLETED || a.status === AppointmentStatus.CANCELLED || new Date(a.startTime) < now)
      .filter((a) => a.id !== nextAppointment?.id)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
  }, [patientAppointments, now, nextAppointment])

  const handleCancelAppointment = (aptId: string) => {
    const finalReason = cancellationReason === "Otro" ? (otherReason || "Sin especificar") : cancellationReason
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === aptId
          ? {
              ...apt,
              status: AppointmentStatus.CANCELLED,
              notes: `Cancelada por el paciente: ${finalReason}`,
            }
          : apt
      )
    )
    setCancelModalOpen(false)
    setFeedbackNotice("Tu cita ha sido cancelada. Tu psicóloga ha sido notificada.")
    setTimeout(() => setFeedbackNotice(null), 4000)
  }

  // Formato de fecha amigable para la tarjeta héroe
  const formatHeroDate = (date: Date | string) => {
    const d = new Date(date)
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }
    const formatted = d.toLocaleDateString("es-MX", options)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. CABECERA (HEADER AMIGABLE) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/70">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-heading">
            {friendlyGreeting}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Bienvenida a tu espacio personal de bienestar y acompañamiento terapéutico
          </p>
        </div>

        {/* Notificaciones, Perfil y Acción Principal */}
        <div className="flex items-center gap-3">
          {/* Acción Principal: + Solicitar Nueva Cita (visible en cabecera) */}
          <Button
            asChild
            className="hidden sm:inline-flex h-9 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs active:scale-[0.98] transition-all"
          >
            <Link href="/agenda/nueva">
              <Plus className="mr-1.5 size-4 stroke-[2.5]" />
              + Solicitar Nueva Cita
            </Link>
          </Button>

          {/* Icono de Notificaciones */}
          <Link
            href="/notificaciones"
            className="relative p-2.5 rounded-xl border border-border/80 bg-card text-foreground hover:bg-muted/70 hover:border-primary/40 transition-colors shadow-2xs"
            title="Notificaciones y recordatorios de citas"
            aria-label="Notificaciones"
          >
            <Bell className="size-5" />
            <span className="absolute -top-1.5 -right-1.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-xs ring-2 ring-background">
              2
            </span>
          </Link>

          {/* Foto de Perfil */}
          <Link
            href="/perfil"
            className="flex items-center gap-2 p-1.5 pr-3 rounded-xl border border-border/80 bg-card hover:bg-muted/60 hover:border-primary/40 transition-colors shadow-2xs group"
            title="Mi Perfil"
          >
            <div className="relative size-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20">
              {getInitials(patient?.name || "Paciente")}
              <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-background" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold leading-tight text-foreground group-hover:text-primary transition-colors truncate max-w-[110px]">
                {cleanFirstName}
              </p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                Paciente
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* AVISO DE ACCIÓN (FEEDBACK) */}
      {feedbackNotice && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-xs text-foreground shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-primary" />
            <span className="font-medium">{feedbackNotice}</span>
          </div>
          <button
            onClick={() => setFeedbackNotice(null)}
            className="text-primary hover:text-foreground text-xs px-2 py-0.5"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* 2. TARJETA DESTACADA (HÉROE - PRÓXIMA CITA) */}
      {nextAppointment ? (
        <Card className="border border-primary/25 bg-card shadow-xs relative overflow-hidden rounded-2xl">
          {/* Barra superior de acento con el verde base */}
          <div className="h-1.5 w-full bg-primary/80" />

          <CardHeader className="p-5 sm:p-6 pb-4 border-b border-border/40 bg-muted/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarCheck className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold text-foreground font-heading">
                  Tu Próxima Cita
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Atención personalizada con {MOCK_PSYCHOLOGIST.name}
                </CardDescription>
              </div>
            </div>

            {/* Estado de la Cita */}
            <div>
              {nextAppointment.status === AppointmentStatus.CONFIRMED ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 text-primary px-3 py-1 text-xs font-semibold shadow-2xs">
                  <CheckCircle2 className="size-3.5 text-primary" />
                  Confirmada
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 px-3 py-1 text-xs font-medium shadow-2xs">
                  <Clock className="size-3.5 text-amber-600 dark:text-amber-400" />
                  Por confirmar
                </span>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-5 sm:p-6 space-y-6">
            <div className="grid gap-5 sm:grid-cols-3">
              {/* Fecha y Hora */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Fecha y Hora
                </span>
                <p className="text-base sm:text-lg font-bold text-foreground font-heading">
                  {formatHeroDate(nextAppointment.startTime)}
                </p>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/10 text-primary font-mono text-xs font-semibold border border-primary/20">
                  <Clock className="size-3 text-primary" />
                  <span>{formatAppointmentTime(new Date(nextAppointment.startTime))} hrs</span>
                  <span className="opacity-50">({nextAppointment.durationMinutes} min)</span>
                </div>
              </div>

              {/* Modalidad de la Sesión */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Modalidad
                </span>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  {nextAppointment.modality === AppointmentModality.VIRTUAL ? (
                    <>
                      <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <Video className="size-3.5" />
                      </div>
                      <span>Sesión Virtual (Videollamada)</span>
                    </>
                  ) : (
                    <>
                      <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <MapPin className="size-3.5" />
                      </div>
                      <span>Presencial en Consultorio</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {nextAppointment.modality === AppointmentModality.VIRTUAL
                    ? "Enlace encriptado y confidencial listo para tu sesión."
                    : "Paseo de la Reforma #450, Piso 3, Consultorio 3B, CDMX."}
                </p>
              </div>

              {/* Psicólogo Asignado */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Psicólogo / Terapeuta
                </span>
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20 shrink-0">
                    AG
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {MOCK_PSYCHOLOGIST.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {MOCK_PSYCHOLOGIST.specialty}
                    </p>
                  </div>
                </div>
                {nextAppointment.reason && (
                  <p className="text-xs text-muted-foreground pt-1 italic line-clamp-1">
                    "{nextAppointment.reason}"
                  </p>
                )}
              </div>
            </div>

            {/* Si es virtual: Enlace de videollamada */}
            {nextAppointment.modality === AppointmentModality.VIRTUAL && (
              <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Video className="size-4 text-primary shrink-0" />
                  <span className="text-xs text-foreground font-medium">
                    Tu sala de videollamada se habilitará antes de la hora fijada.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10 font-semibold"
                  onClick={() => window.open("https://meet.google.com/psi-diag-ses", "_blank")}
                >
                  <Video className="mr-1.5 size-3.5" />
                  Abrir Videollamada
                </Button>
              </div>
            )}

            {/* BOTONES SECUNDARIOS: Reagendar y Cancelar */}
            <div className="pt-4 border-t border-border/50 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRescheduleModalOpen(true)}
                  className="rounded-xl border-border/80 text-xs font-medium hover:border-primary/40 hover:text-primary hover:bg-primary/[0.03]"
                >
                  <CalendarSync className="mr-1.5 size-3.5 text-primary" />
                  Reagendar
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelModalOpen(true)}
                  className="rounded-xl border-border/80 text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                >
                  <XCircle className="mr-1.5 size-3.5" />
                  Cancelar
                </Button>
              </div>

              <Link
                href={`/agenda/${nextAppointment.id}`}
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                <span>Ver detalles completos</span>
                <ChevronRight className="size-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Estado Vacío del Héroe: No hay citas próximas */
        <Card className="border border-border/80 bg-card shadow-xs rounded-2xl p-8 sm:p-10 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="size-14 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center border border-primary/20">
              <CalendarPlus className="size-7" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-bold font-heading text-foreground">
                No tienes citas próximas programadas
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                La constancia es un pilar esencial en tu proceso terapéutico. Puedes programar una sesión en el día y horario que mejor te convenga.
              </p>
            </div>
            <Button
              asChild
              className="h-11 px-6 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-semibold shadow-xs"
            >
              <Link href="/agenda/nueva">
                <Plus className="mr-1.5 size-4 stroke-[2.5]" />
                Solicitar Cita con Dra. Ana García
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {/* 3. SECCIÓN INFERIOR (ACTIVIDAD RECIENTE: MIS ÚLTIMAS CITAS) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground font-heading">
              Mis últimas citas
            </h2>
            <p className="text-xs text-muted-foreground">
              Historial breve de tus consultas anteriores en PsicoAgenda
            </p>
          </div>

          <Button variant="ghost" size="sm" asChild className="text-xs text-primary hover:text-primary/80">
            <Link href="/agenda" className="flex items-center gap-1">
              <span>Ver todas</span>
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        {pastAppointments.length > 0 ? (
          <div className="space-y-2.5">
            {pastAppointments.slice(0, 4).map((apt) => {
              const aptDate = formatShortDate(new Date(apt.startTime))
              const aptTime = formatAppointmentTime(new Date(apt.startTime))
              const isAttended = apt.attendanceStatus === AttendanceStatus.ATTENDED || apt.status === AppointmentStatus.COMPLETED
              const isCancelled = apt.status === AppointmentStatus.CANCELLED

              return (
                <div
                  key={apt.id}
                  className="rounded-xl border border-border/80 bg-card p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-primary/30 transition-all shadow-2xs"
                >
                  <div className="flex items-start gap-3">
                    <div className="size-9 rounded-lg bg-muted/60 border border-border/60 flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                      <CalendarDays className="size-4 text-primary" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">
                          {aptDate} · {aptTime} hrs
                        </span>
                        <span className="text-[11px] text-muted-foreground px-2 py-0.2 rounded border border-border/60 bg-muted/40">
                          {apt.modality === AppointmentModality.VIRTUAL ? "Virtual" : "Presencial"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Atendida por {MOCK_PSYCHOLOGIST.name} • {apt.reason || "Consulta clínica"}
                      </p>
                    </div>
                  </div>

                  {/* Estado de la cita pasada: Asistió / Cancelada */}
                  <div className="flex items-center gap-2 self-start sm:self-center">
                    {isAttended ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium shadow-2xs">
                        <CheckCircle2 className="size-3 text-primary" />
                        Asistió
                      </span>
                    ) : isCancelled ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 text-muted-foreground px-2.5 py-0.5 text-xs font-medium">
                        <XCircle className="size-3" />
                        Cancelada
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        Completada
                      </span>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="size-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      <Link href={`/agenda/${apt.id}`} title="Ver detalles">
                        <ChevronRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="p-8 text-center rounded-xl border border-dashed border-border/70 bg-card text-xs text-muted-foreground">
            Aún no tienes un historial previo de citas registradas.
          </div>
        )}
      </div>

      {/* ACCIÓN PRINCIPAL FLOTANTE (Móvil) */}
      <Link
        href="/agenda/nueva"
        className="fixed bottom-20 right-4 lg:hidden z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-primary text-primary-foreground shadow-lg font-semibold text-xs active:scale-95 transition-all"
        title="Solicitar Nueva Cita"
      >
        <Plus className="size-4 stroke-[2.5]" />
        <span>+ Solicitar Cita</span>
      </Link>

      {/* MODAL 1: REAGENDAR CITA */}
      {nextAppointment && (
        <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
          <DialogContent className="max-w-md border-border/80 bg-background text-foreground">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <CalendarSync className="size-5 text-primary" />
                <span>Reagendar Cita</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Sesión con {MOCK_PSYCHOLOGIST.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Actualmente tienes tu cita programada para el{" "}
                <strong className="text-foreground">{formatHeroDate(nextAppointment.startTime)}</strong> a las{" "}
                <strong className="text-foreground">{formatAppointmentTime(new Date(nextAppointment.startTime))} hrs</strong>.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Al reagendar, podrás explorar el calendario de disponibilidad de tu psicóloga y seleccionar un nuevo horario conveniente.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setRescheduleModalOpen(false)}
              >
                Volver
              </Button>
              <Button
                size="sm"
                asChild
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Link href={`/agenda/${nextAppointment.id}`}>
                  Ir a Seleccionar Nueva Fecha
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 2: CANCELAR CITA */}
      {nextAppointment && (
        <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
          <DialogContent className="max-w-md border-border/80 bg-background text-foreground">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
                <XCircle className="size-5" />
                <span>Cancelar Cita Programada</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cita del {formatHeroDate(nextAppointment.startTime)} a las {formatAppointmentTime(new Date(nextAppointment.startTime))} hrs
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Lamentamos que no puedas asistir. Por favor compártenos el motivo de la cancelación para informar a tu psicóloga y liberar el espacio clínico:
              </p>

              <div className="space-y-2 pt-1">
                {[
                  "Inconveniente de horario o imprevisto",
                  "Motivos de salud física",
                  "Compromiso laboral o escolar",
                  "Otro",
                ].map((reason) => (
                  <label
                    key={reason}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border/60 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <input
                      type="radio"
                      name="cancel-reason"
                      value={reason}
                      checked={cancellationReason === reason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      className="accent-primary"
                    />
                    <span className="text-xs text-foreground font-medium">{reason}</span>
                  </label>
                ))}
              </div>

              {cancellationReason === "Otro" && (
                <textarea
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Escribe brevemente el motivo..."
                  rows={2}
                  className="w-full rounded-lg border border-border p-2.5 text-xs text-foreground bg-muted/20 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setCancelModalOpen(false)}
              >
                Mantener mi Cita
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="text-xs"
                onClick={() => handleCancelAppointment(nextAppointment.id)}
              >
                Confirmar Cancelación
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

