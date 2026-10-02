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

function getWireframeStatusBadge(status: AppointmentStatus) {
  switch (status) {
    case AppointmentStatus.CONFIRMED:
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 px-2 py-0.5 text-[11px] font-semibold tracking-tight">
          <CheckCircle2 className="size-3" />
          Confirmada
        </span>
      )
    case AppointmentStatus.PENDING:
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-2 py-0.5 text-[11px] font-medium">
          <Clock className="size-3 text-zinc-500" />
          Pendiente
        </span>
      )
    case AppointmentStatus.COMPLETED:
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 text-[11px] font-medium">
          <CheckCircle2 className="size-3 text-zinc-400" />
          Completada
        </span>
      )
    case AppointmentStatus.CANCELLED:
      return (
        <span className="inline-flex items-center gap-1 rounded-md border border-zinc-400 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 text-[11px] font-medium line-through">
          <XCircle className="size-3 text-zinc-500" />
          Cancelada
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
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
  const cleanName = rawName.replace(/^(Dra\.|Dr\.|Psic\.|Lic\.)\s*/i, "")
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
    setActionNotice("Asistencia registrada. La sesión fue completada.")
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
      {/* 1. CABECERA (HEADER ESTRUCTURAL WIREFRAME) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-heading">
            {psychologistGreeting}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {formattedTodayHeader} • Panel de Práctica Clínica
          </p>
        </div>

        {/* Campana de Notificaciones con Indicador Numérico y Foto de Perfil */}
        <div className="flex items-center gap-3">
          <Link
            href="/notificaciones"
            className="relative p-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 transition-colors shadow-2xs"
            title="Notificaciones de citas y recordatorios"
            aria-label="Notificaciones"
          >
            <Bell className="size-5" />
            <span className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[10px] font-bold shadow-xs">
              3
            </span>
          </Link>

          <Link
            href="/perfil"
            className="flex items-center gap-2.5 p-1.5 pr-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shadow-2xs group"
            title="Configuración de Perfil Clínico"
          >
            <div className="relative size-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs flex items-center justify-center border border-zinc-300 dark:border-zinc-600">
              {getInitials(rawName)}
              <span className="absolute -bottom-0.5 -right-0.5 size-2 rounded-full bg-zinc-800 dark:bg-zinc-200 ring-2 ring-white dark:ring-zinc-900" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold leading-tight text-zinc-900 dark:text-zinc-100 group-hover:underline truncate max-w-[120px]">
                Psic. {cleanName}
              </p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-none">
                En consulta
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* AVISO DE ACCIÓN (FEEDBACK) */}
      {actionNotice && (
        <div className="flex items-center justify-between rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800/80 px-4 py-3 text-xs text-zinc-900 dark:text-zinc-100 shadow-2xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 text-zinc-700 dark:text-zinc-300" />
            <span className="font-medium">{actionNotice}</span>
          </div>
          <button
            onClick={() => setActionNotice(null)}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs px-2 py-0.5"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* 2. SECCIÓN DE ACCIONES RÁPIDAS (3 BOTONES PRINCIPALES DESTACADOS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Botón 1: + Nueva Cita */}
        <Link
          href="/agenda/nueva"
          className="group flex items-center justify-between p-4 rounded-xl border-2 border-zinc-900 bg-zinc-900 text-white hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all shadow-xs"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Plus className="size-4 shrink-0 stroke-[2.5]" />
              <span className="font-semibold text-sm tracking-tight">+ Nueva Cita</span>
            </div>
            <p className="text-xs text-zinc-300 dark:text-zinc-600">
              Agendar consulta en calendario
            </p>
          </div>
          <ChevronRight className="size-4 opacity-70 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {/* Botón 2: + Nuevo Paciente */}
        <Link
          href="/pacientes"
          className="group flex items-center justify-between p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-all shadow-2xs"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <UserPlus className="size-4 shrink-0 text-zinc-700 dark:text-zinc-300 stroke-[2.2]" />
              <span className="font-semibold text-sm tracking-tight">+ Nuevo Paciente</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Registrar expediente clínico
            </p>
          </div>
          <ChevronRight className="size-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        {/* Botón 3: Generar Reporte */}
        <Link
          href="/reportes"
          className="group flex items-center justify-between p-4 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 transition-all shadow-2xs"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <FileText className="size-4 shrink-0 text-zinc-700 dark:text-zinc-300 stroke-[2.2]" />
              <span className="font-semibold text-sm tracking-tight">Generar Reporte</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Hojas de asistencia y métricas
            </p>
          </div>
          <ChevronRight className="size-4 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* DISPOSICIÓN PRINCIPAL EN 2 COLUMNAS (IZQUIERDA Y DERECHA) */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 3. COLUMNA PRINCIPAL (IZQUIERDA - PRÓXIMAS CITAS PROGRAMADAS PARA HOY) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 tracking-tight font-heading">
                  Próximas Citas (Hoy)
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-md border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                  {todayAppointments.length}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Consultas agendadas exclusivamente para el día de hoy
              </p>
            </div>

            {/* Filtros rápidos: Todas, Confirmadas, Pendientes */}
            <div className="flex items-center rounded-lg border border-zinc-300 dark:border-zinc-700 p-0.5 bg-zinc-50 dark:bg-zinc-900 text-xs self-start sm:self-auto">
              <button
                onClick={() => setAgendaFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors",
                  agendaFilter === "all"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs border border-zinc-200 dark:border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                Todas ({todayAppointments.length})
              </button>
              <button
                onClick={() => setAgendaFilter("confirmed")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors",
                  agendaFilter === "confirmed"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs border border-zinc-200 dark:border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                )}
              >
                Confirmadas ({confirmedTodayCount})
              </button>
              <button
                onClick={() => setAgendaFilter("pending")}
                className={cn(
                  "px-2.5 py-1 rounded-md font-medium transition-colors",
                  agendaFilter === "pending"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs border border-zinc-200 dark:border-zinc-700"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
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
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 transition-all hover:border-zinc-400 dark:hover:border-zinc-600 shadow-2xs space-y-3"
                >
                  {/* Fila superior: Hora, Modalidad y Estado de la cita */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs font-semibold border border-zinc-200 dark:border-zinc-700">
                        <Clock className="size-3 text-zinc-600 dark:text-zinc-400" />
                        {startTime} – {endTime}
                      </span>

                      {apt.modality === AppointmentModality.VIRTUAL ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                          <Video className="size-3 text-zinc-500" />
                          Virtual
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                          <MapPin className="size-3 text-zinc-500" />
                          Presencial
                        </span>
                      )}
                    </div>

                    {/* Estado de la cita (Confirmada / Pendiente) */}
                    <div>{getWireframeStatusBadge(apt.status)}</div>
                  </div>

                  {/* Fila central: Nombre del Paciente y Motivo de Consulta */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-800 dark:text-zinc-200 shrink-0">
                        {getInitials(patientName)}
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                            {patientName}
                          </p>
                          {patient?.isMinor && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800">
                              Menor de edad
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
                          {apt.reason || "Sesión de terapia clínica programada"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Fila inferior: Botones de acceso rápido "Ver Expediente" y "Iniciar Sesión" */}
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 text-xs font-medium border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                    >
                      <Link href={`/pacientes/${apt.patientId}`}>
                        <FileText className="mr-1.5 size-3.5 text-zinc-500" />
                        Ver Expediente
                      </Link>
                    </Button>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => setActiveSessionAppointment(apt)}
                        className="h-8 text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 rounded-lg shadow-xs"
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
              <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center space-y-2.5 bg-white dark:bg-zinc-900">
                <CalendarDays className="size-8 mx-auto text-zinc-400 stroke-1" />
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  No hay citas {agendaFilter !== "all" ? `${agendaFilter}s` : ""} programadas para hoy
                </p>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Puedes revisar las demás citas en la agenda o registrar una nueva sesión clínica.
                </p>
                <Button
                  size="sm"
                  asChild
                  className="mt-2 text-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 rounded-lg"
                >
                  <Link href="/agenda/nueva">+ Nueva Cita</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 4. COLUMNA SECUNDARIA (DERECHA - MINI-CALENDARIO Y MÉTRICAS RÁPIDAS) */}
        <div className="space-y-4">
          {/* MINI-CALENDARIO MENSUAL ESTRUCTURAL */}
          <div className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-3.5 shadow-2xs">
            {/* Cabecera del mini-calendario */}
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2.5">
              <span className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 tracking-tight">
                {formattedMonth}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  title="Mes anterior"
                  aria-label="Mes anterior"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-md border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                  title="Mes siguiente"
                  aria-label="Mes siguiente"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Días de la semana abreviados */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase">
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
                      !item.isCurrentMonth && "text-zinc-300 dark:text-zinc-600",
                      item.isCurrentMonth && "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800",
                      item.isToday && "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold hover:bg-zinc-800",
                      item.isSelected && !item.isToday && "ring-1 ring-zinc-500 font-semibold"
                    )}
                  >
                    <span>{dayNumber}</span>
                    {/* Indicador de citas en el día */}
                    {item.hasAppointments && (
                      <span
                        className={cn(
                          "size-1 rounded-full absolute bottom-1",
                          item.isToday
                            ? "bg-white dark:bg-zinc-900"
                            : "bg-zinc-900 dark:bg-zinc-200"
                        )}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Pie del calendario con leyenda y enlace directo a la agenda completa */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-zinc-800 dark:bg-zinc-200 inline-block" />
                Días con citas
              </span>
              <Link
                href="/agenda"
                className="font-medium text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1"
              >
                <span>Ver agenda</span>
                <ChevronRight className="size-3" />
              </Link>
            </div>
          </div>

          {/* BLOQUE DE MÉTRICAS RÁPIDAS (ESTRUCTURAL WIREFRAME) */}
          <div className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100 font-heading">
                Métricas Rápidas
              </h3>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                Semana en curso
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                  <CalendarDays className="size-3.5 text-zinc-500" />
                  Citas hoy
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tabular-nums">
                  {todayAppointments.length}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-zinc-500" />
                  Confirmadas hoy
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tabular-nums">
                  {confirmedTodayCount}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                  <Clock className="size-3.5 text-zinc-500" />
                  Pendientes hoy
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tabular-nums">
                  {pendingTodayCount}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
                <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                  <XCircle className="size-3.5 text-zinc-500" />
                  Canceladas esta semana
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tabular-nums">
                  {cancelledThisWeekCount}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                  <Users className="size-3.5 text-zinc-500" />
                  Pacientes activos
                </span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100 text-sm tabular-nums">
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
          <DialogContent className="max-w-md border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="size-5 text-zinc-800 dark:text-zinc-200" />
                <span>Gestión de Sesión Clínica</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
                Paciente: {getPatientById(activeSessionAppointment.patientId)?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Horario programado:</span>
                  <span className="font-mono font-semibold">
                    {formatAppointmentTime(new Date(activeSessionAppointment.startTime))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Modalidad:</span>
                  <span className="font-medium capitalize">
                    {activeSessionAppointment.modality === AppointmentModality.VIRTUAL ? "Videollamada" : "Presencial"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Motivo:</span>
                  <span className="font-medium truncate max-w-[200px]">
                    {activeSessionAppointment.reason || "Sin especificar"}
                  </span>
                </div>
              </div>

              {activeSessionAppointment.modality === AppointmentModality.VIRTUAL && (
                <div className="p-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-100/70 dark:bg-zinc-800/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="size-4 text-zinc-700 dark:text-zinc-300" />
                    <span className="font-medium text-xs">Enlace de videollamada</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-zinc-300 dark:border-zinc-600"
                    onClick={() => {
                      window.open("https://meet.google.com/psi-diag-ses", "_blank")
                    }}
                  >
                    Unirse ahora
                  </Button>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-zinc-300 dark:border-zinc-700"
                onClick={() => setActiveSessionAppointment(null)}
              >
                Cerrar
              </Button>

              {activeSessionAppointment.status === AppointmentStatus.PENDING && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-zinc-400 dark:border-zinc-600"
                  onClick={() => handleConfirmAppointment(activeSessionAppointment.id)}
                >
                  Confirmar Cita
                </Button>
              )}

              <Button
                size="sm"
                className="text-xs bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
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
  const patientAppointments = MOCK_APPOINTMENTS.filter((a) => a.patientId === patient.id)

  const [completedTasks, setCompletedTasks] = useState<Record<number, boolean>>({ 0: true })
  const [copiedPhone, setCopiedPhone] = useState(false)

  const homeworkList = getLatestHomeworkForPatient(patient.id)

  // Upcoming appointment for patient
  const now = new Date()
  const upcomingAppointments = patientAppointments
    .filter((a) => a.status !== AppointmentStatus.COMPLETED && a.status !== AppointmentStatus.CANCELLED)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const nextAppointment = upcomingAppointments[0] || null

  // Past appointments
  const pastAppointments = patientAppointments
    .filter((a) => a.status === AppointmentStatus.COMPLETED || new Date(a.startTime) < now)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())

  const toggleTask = (index: number) => {
    setCompletedTasks((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const copyEmergencyPhone = () => {
    if (patient.emergencyContact?.phone) {
      navigator.clipboard.writeText(patient.emergencyContact.phone)
      setCopiedPhone(true)
      setTimeout(() => setCopiedPhone(false), 2000)
    }
  }

  const completedCount = Object.values(completedTasks).filter(Boolean).length

  return (
    <div className="space-y-6">
      <PageHeader
        title={`¡Hola, ${patient.name}!`}
        description="Bienvenida a tu espacio de atención terapéutica • Citas programadas, acuerdos y contacto con tu psicóloga"
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              asChild
              className="rounded-xl border-border/60 text-xs font-medium hover:bg-muted/60 active:scale-[0.98] transition-all"
            >
              <Link href="/agenda">
                <CalendarDays className="mr-1.5 size-3.5" />
                Mis Citas
              </Link>
            </Button>
            <Button
              asChild
              className="rounded-xl bg-primary text-primary-foreground shadow-xs font-medium text-xs hover:bg-primary/90 active:scale-[0.98] transition-all"
            >
              <Link href="/agenda/nueva">
                <Plus className="mr-1.5 size-3.5" />
                + Solicitar Cita
              </Link>
            </Button>
          </div>
        }
      />

      {/* 1. Tarjeta Destacada: Próxima Sesión */}
      {nextAppointment ? (
        <Card className="border-emerald-300/80 bg-emerald-50/40 dark:bg-emerald-950/20 dark:border-emerald-800 shadow-2xs overflow-hidden">
          <CardHeader className="pb-3 border-b border-emerald-200/60 dark:border-emerald-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                <CalendarDays className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base font-semibold text-foreground font-heading">
                  Tu Próxima Sesión de Terapia
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Programada con {MOCK_PSYCHOLOGIST.name}
                </CardDescription>
              </div>
            </div>
            <div>{getStatusBadge(nextAppointment.status)}</div>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Fecha y Hora
                </span>
                <p className="text-base font-bold text-foreground">
                  {formatShortDate(nextAppointment.startTime)} · {formatAppointmentTime(nextAppointment.startTime)} hrs
                </p>
                <p className="text-xs text-muted-foreground">
                  Duración aproximada: {nextAppointment.durationMinutes} minutos
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Modalidad de Atención
                </span>
                <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {nextAppointment.modality === AppointmentModality.VIRTUAL ? (
                    <>
                      <Video className="size-4 text-primary" />
                      <span>Sesión Virtual (Videollamada)</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="size-4 text-primary" />
                      <span>Presencial en Consultorio</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {nextAppointment.modality === AppointmentModality.VIRTUAL
                    ? "El enlace seguro se activa 10 min antes."
                    : "Paseo de la Reforma #450, Piso 3, Consultorio 3B, CDMX."}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Motivo / Enfoque
                </span>
                <p className="text-sm font-medium text-foreground">
                  {nextAppointment.reason || "Sesión de seguimiento terapéutico"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Psicología clínica & Terapia Cognitivo-Conductual
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
              <Button asChild size="sm" className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-2xs">
                <Link href={`/agenda/${nextAppointment.id}`}>
                  Ver detalles de mi cita
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="rounded-xl text-xs border-border/80">
                <Link href={`/agenda/${nextAppointment.id}`}>
                  Reagendar o Cancelar
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/70 shadow-2xs bg-card p-6 text-center">
          <div className="max-w-md mx-auto space-y-3">
            <div className="size-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
              <CalendarDays className="size-6" />
            </div>
            <h3 className="text-lg font-bold font-heading text-foreground">
              No tienes citas programadas actualmente
            </h3>
            <p className="text-xs text-muted-foreground">
              Recuerda que la constancia entre sesiones es clave para tu proceso terapéutico. Puedes solicitar una cita según la disponibilidad de tu psicóloga.
            </p>
            <Button asChild className="rounded-xl bg-primary text-primary-foreground text-xs font-semibold h-10 px-5 shadow-2xs">
              <Link href="/agenda/nueva">
                <Plus className="mr-1.5 size-4" />
                Solicitar Cita con Dra. Ana García
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {/* 2. Grid de Información: Terapeuta y Tareas Intersesión */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Mi Terapeuta */}
        <Card className="border-border/70 shadow-2xs bg-card flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
              <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
                <User className="size-4 text-primary" />
                <span>Tu Profesional Terapéutico</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Responsable del acompañamiento y custodia de tu expediente
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="flex items-start gap-4">
                <div className="size-14 rounded-2xl bg-primary/10 text-primary font-bold text-lg flex items-center justify-center shrink-0 font-heading">
                  AG
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-foreground">
                      {MOCK_PSYCHOLOGIST.name}
                    </h4>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5">
                      {MOCK_PSYCHOLOGIST.licenseNumber}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {MOCK_PSYCHOLOGIST.specialty}
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed pt-1">
                    {MOCK_PSYCHOLOGIST.bio}
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-muted/20 border border-border/50 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-3.5 text-primary" />
                  <span>Consultorio: {MOCK_PSYCHOLOGIST.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-3.5 text-primary" />
                  <span>{MOCK_PSYCHOLOGIST.email}</span>
                </div>
              </div>
            </CardContent>
          </div>

          <CardFooter className="p-4 border-t border-border/50 bg-muted/10 flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
            <span>Atención confidencial bajo secreto profesional y normativa LFPDPPP.</span>
          </CardFooter>
        </Card>

        {/* Tareas y Acuerdos Intersesión */}
        <Card className="border-border/70 shadow-2xs bg-card flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/10 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <span>Acuerdos y Tareas Intersesión</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Compromisos acordados en tu última sesión terapéutica
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs font-semibold">
                {completedCount} de {homeworkList.length} listos
              </Badge>
            </CardHeader>

            <CardContent className="p-5 space-y-3">
              <div className="space-y-2.5">
                {homeworkList.map((hw, idx) => {
                  const isDone = Boolean(completedTasks[idx])
                  return (
                    <div
                      key={idx}
                      onClick={() => toggleTask(idx)}
                      className={cn(
                        "p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none",
                        isDone
                          ? "bg-emerald-50/50 border-emerald-200/80 text-foreground dark:bg-emerald-950/20 dark:border-emerald-800"
                          : "bg-muted/20 border-border/60 hover:border-primary/40 text-foreground"
                      )}
                    >
                      <button
                        type="button"
                        className={cn(
                          "mt-0.5 size-4 rounded flex items-center justify-center transition-colors shrink-0",
                          isDone ? "bg-emerald-600 text-white" : "border border-border"
                        )}
                      >
                        {isDone && <Check className="size-3" />}
                      </button>
                      <div className="space-y-0.5 text-xs leading-relaxed">
                        <p className={cn("font-medium", isDone && "line-through text-muted-foreground")}>
                          {hw}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-[11px] text-muted-foreground pt-1 leading-relaxed">
                💡 Consejo: Llevar registro de tus ejercicios intersesión enriquece el trabajo durante tu próxima consulta.
              </p>
            </CardContent>
          </div>

          <CardFooter className="p-4 border-t border-border/50 bg-muted/10 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Revisión programada:</span>
            <span className="font-semibold text-foreground">En tu siguiente sesión</span>
          </CardFooter>
        </Card>
      </div>

      {/* 3. Mis Sesiones Recientes y Contacto de Emergencia */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Historial de Sesiones Recientes (2 columnas) */}
        <div className="md:col-span-2">
          <Card className="border-border/70 shadow-2xs bg-card">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/10 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
                  <CalendarDays className="size-4 text-primary" />
                  <span>Historial de Sesiones Previas</span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Registro de tus consultas anteriores en PsicoAgenda
                </CardDescription>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-xs text-primary">
                <Link href="/agenda" className="flex items-center gap-1">
                  <span>Ver todas</span>
                  <ChevronRight className="size-3.5" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              {pastAppointments.length > 0 ? (
                pastAppointments.slice(0, 3).map((apt) => (
                  <div
                    key={apt.id}
                    className="p-3 rounded-xl border border-border/60 bg-muted/15 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">
                          {formatShortDate(apt.startTime)} · {formatAppointmentTime(apt.startTime)} hrs
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {apt.modality === AppointmentModality.VIRTUAL ? "Virtual" : "Presencial"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{apt.reason || "Consulta psicológica"}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {getStatusBadge(apt.status)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  Aún no tienes sesiones pasadas completadas.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Contacto de Emergencia Registrado (1 columna) */}
        <div>
          <Card className="border-border/70 shadow-2xs bg-card">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
              <CardTitle className="text-sm font-semibold text-foreground font-heading flex items-center gap-2">
                <Phone className="size-4 text-amber-600" />
                <span>Contacto de Emergencia</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Registrado para tu seguridad clínica
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              {patient.emergencyContact ? (
                <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80 dark:bg-amber-950/20 dark:border-amber-900/60 space-y-1.5">
                  <p className="font-bold text-foreground">
                    {patient.emergencyContact.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      ({patient.emergencyContact.relationship})
                    </span>
                  </p>
                  <p className="font-mono text-amber-900 dark:text-amber-200 font-semibold">
                    {patient.emergencyContact.phone}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={copyEmergencyPhone}
                    className="w-full mt-2 h-7 text-[11px] rounded-lg border-amber-300 dark:border-amber-800"
                  >
                    {copiedPhone ? "✓ Copiado" : "Copiar teléfono"}
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground">Sin contacto de emergencia asignado.</p>
              )}

              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                Puedes actualizar tu contacto de emergencia en tu sección de Perfil.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
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

