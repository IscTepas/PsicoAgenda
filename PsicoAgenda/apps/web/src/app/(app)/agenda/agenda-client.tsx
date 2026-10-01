"use client"

import * as React from "react"
import Link from "next/link"
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  Clock3,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  User,
  FileText,
  Phone,
  Mail,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Check,
} from "lucide-react"
import {
  APP_NAME,
  AppointmentStatus,
  AppointmentModality,
  type Appointment,
  type Patient,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useSession } from "@/lib/use-session"
import {
  MOCK_APPOINTMENTS,
  MOCK_PSYCHOLOGIST,
  MOCK_CLINICAL_RECORD,
  getPatientById,
  formatAppointmentTime,
  formatShortDate,
} from "@/lib/mock-data"

type CalendarView = "mes" | "semana" | "dia"

interface StatusConfig {
  label: string
  dotClass: string
  badgeClass: string
  borderClass: string
  bgSoftClass: string
  icon: React.ComponentType<{ className?: string }>
}

const STATUS_CONFIG: Record<AppointmentStatus, StatusConfig> = {
  [AppointmentStatus.CONFIRMED]: {
    label: "Confirmada",
    dotClass: "bg-emerald-500",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    borderClass: "border-l-emerald-500",
    bgSoftClass: "bg-emerald-50/50 hover:bg-emerald-50/80 dark:bg-emerald-950/20",
    icon: CheckCircle2,
  },
  [AppointmentStatus.PENDING]: {
    label: "Pendiente",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    borderClass: "border-l-amber-500",
    bgSoftClass: "bg-amber-50/50 hover:bg-amber-50/80 dark:bg-amber-950/20",
    icon: AlertCircle,
  },
  [AppointmentStatus.CANCELLED]: {
    label: "Cancelada",
    dotClass: "bg-rose-500",
    badgeClass: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
    borderClass: "border-l-rose-500",
    bgSoftClass: "bg-rose-50/40 hover:bg-rose-50/70 dark:bg-rose-950/20",
    icon: XCircle,
  },
  [AppointmentStatus.COMPLETED]: {
    label: "Completada",
    dotClass: "bg-slate-400",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    borderClass: "border-l-slate-400",
    bgSoftClass: "bg-slate-50/60 hover:bg-slate-50/90 dark:bg-slate-900/30",
    icon: Check,
  },
  [AppointmentStatus.NO_SHOW]: {
    label: "No asistió",
    dotClass: "bg-gray-400",
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
    borderClass: "border-l-gray-400",
    bgSoftClass: "bg-gray-50/60 dark:bg-gray-900/30",
    icon: HelpCircle,
  },
}

const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
const DAYS_OF_WEEK_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

const HOURLY_SLOTS = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19
]

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Adjust so Monday is 0 and Sunday is 6
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekDays(startDate: Date): Date[] {
  const start = getStartOfWeek(startDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

function getMonthDays(currentDate: Date): { date: Date; isCurrentMonth: boolean }[] {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)

  // In JS, getDay(): Sunday=0, Monday=1, ... Saturday=6
  // We want Monday=0, ... Sunday=6
  const startingDayIndex = (firstDayOfMonth.getDay() + 6) % 7
  const daysInMonth = lastDayOfMonth.getDate()

  const days: { date: Date; isCurrentMonth: boolean }[] = []

  // Preceding days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = startingDayIndex - 1; i >= 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthLastDay - i),
      isCurrentMonth: false,
    })
  }

  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    })
  }

  // Trailing days from next month to fill complete grid rows (multiple of 7)
  const remainingDays = (7 - (days.length % 7)) % 7
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    })
  }

  return days
}

export function AgendaClient() {
  const { user } = useSession()
  const [currentDate, setCurrentDate] = React.useState<Date>(new Date())
  const [view, setView] = React.useState<CalendarView>("semana")
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL")
  const [searchQuery, setSearchQuery] = React.useState<string>("")
  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null)

  const psychologistName = user?.name || MOCK_PSYCHOLOGIST.name

  // Appointments today for header stats
  const today = new Date()
  const todayAppointments = React.useMemo(() => {
    return MOCK_APPOINTMENTS.filter((apt) => isSameDay(apt.startTime, today))
  }, [today])

  // Filtered appointments according to status & search query
  const filteredAppointments = React.useMemo(() => {
    return MOCK_APPOINTMENTS.filter((apt) => {
      // Status filter
      if (selectedStatus !== "ALL" && apt.status !== selectedStatus) {
        return false
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim()
        const patient = getPatientById(apt.patientId)
        const patientName = patient?.name?.toLowerCase() ?? ""
        const reason = apt.reason?.toLowerCase() ?? ""
        const notes = apt.notes?.toLowerCase() ?? ""
        const statusText = STATUS_CONFIG[apt.status]?.label.toLowerCase() ?? ""

        const matches =
          patientName.includes(query) ||
          reason.includes(query) ||
          notes.includes(query) ||
          statusText.includes(query)

        if (!matches) return false
      }

      return true
    })
  }, [selectedStatus, searchQuery])

  // Counts by status
  const counts = React.useMemo(() => {
    const map: Record<string, number> = {
      ALL: MOCK_APPOINTMENTS.length,
      [AppointmentStatus.CONFIRMED]: 0,
      [AppointmentStatus.PENDING]: 0,
      [AppointmentStatus.CANCELLED]: 0,
      [AppointmentStatus.COMPLETED]: 0,
    }
    MOCK_APPOINTMENTS.forEach((apt) => {
      if (map[apt.status] !== undefined) {
        map[apt.status]++
      }
    })
    return map
  }, [])

  // Navigation handlers
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (view === "dia") {
        next.setDate(prev.getDate() - 1)
      } else if (view === "semana") {
        next.setDate(prev.getDate() - 7)
      } else {
        next.setMonth(prev.getMonth() - 1)
      }
      return next
    })
  }

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      if (view === "dia") {
        next.setDate(prev.getDate() + 1)
      } else if (view === "semana") {
        next.setDate(prev.getDate() + 7)
      } else {
        next.setMonth(prev.getMonth() + 1)
      }
      return next
    })
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Format header title according to current view
  const headerDateLabel = React.useMemo(() => {
    if (view === "dia") {
      const dayName = DAYS_OF_WEEK[(currentDate.getDay() + 6) % 7]
      return `${dayName}, ${currentDate.getDate()} de ${MONTH_NAMES[currentDate.getMonth()]} de ${currentDate.getFullYear()}`
    } else if (view === "semana") {
      const weekDays = getWeekDays(currentDate)
      const first = weekDays[0]
      const last = weekDays[6]
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()} - ${last.getDate()} de ${MONTH_NAMES[first.getMonth()]} de ${first.getFullYear()}`
      } else {
        return `${first.getDate()} de ${MONTH_NAMES[first.getMonth()]} - ${last.getDate()} de ${MONTH_NAMES[last.getMonth()]} de ${last.getFullYear()}`
      }
    } else {
      return `${MONTH_NAMES[currentDate.getMonth()]} de ${currentDate.getFullYear()}`
    }
  }, [view, currentDate])

  return (
    <div className="space-y-6">
      {/* 1. CABECERA: Saludo al usuario, barra de búsqueda rápida y botón + Nueva Cita */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground font-heading">
              ¡Hola, {psychologistName}!
            </h1>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Agenda Activa
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Tienes <span className="font-medium text-foreground">{todayAppointments.length} citas</span> programadas para hoy. Consulta y administra tus sesiones clínicas.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Barra de búsqueda rápida */}
          <div className="relative min-w-[240px] sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar paciente o motivo..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8 h-9 text-sm rounded-xl bg-card border-border/80 focus-visible:ring-primary/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Botón destacado "+ Nueva Cita" */}
          <Button asChild className="h-9 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shrink-0">
            <Link href="/agenda/nueva" className="flex items-center gap-2">
              <Plus className="size-4 stroke-[2.5]" />
              <span className="font-medium">Nueva Cita</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. BARRA DE HERRAMIENTAS: Filtros rápidos, Navegación de Fecha y Selector de Vista (Mes/Semana/Día) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-card p-4 rounded-2xl border border-border/60 shadow-2xs">
        {/* Filtros Rápidos por Estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          <span className="text-xs font-medium text-muted-foreground mr-1 shrink-0 hidden sm:inline">
            Filtrar:
          </span>
          <button
            type="button"
            onClick={() => setSelectedStatus("ALL")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedStatus === "ALL"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>Todas</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                selectedStatus === "ALL" ? "bg-white/20 text-white" : "bg-background text-muted-foreground"
              }`}
            >
              {counts.ALL}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus(AppointmentStatus.CONFIRMED)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedStatus === AppointmentStatus.CONFIRMED
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-emerald-50/70 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100/70 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/60"
            }`}
          >
            <span className="size-2 rounded-full bg-emerald-400 inline-block" />
            <span>Confirmadas</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                selectedStatus === AppointmentStatus.CONFIRMED ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200"
              }`}
            >
              {counts[AppointmentStatus.CONFIRMED]}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus(AppointmentStatus.PENDING)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedStatus === AppointmentStatus.PENDING
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-amber-50/70 text-amber-800 border border-amber-200/80 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60"
            }`}
          >
            <span className="size-2 rounded-full bg-amber-400 inline-block" />
            <span>Pendientes</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                selectedStatus === AppointmentStatus.PENDING ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200"
              }`}
            >
              {counts[AppointmentStatus.PENDING]}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedStatus(AppointmentStatus.CANCELLED)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              selectedStatus === AppointmentStatus.CANCELLED
                ? "bg-rose-600 text-white shadow-2xs"
                : "bg-rose-50/70 text-rose-800 border border-rose-200/80 hover:bg-rose-100/70 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/60"
            }`}
          >
            <span className="size-2 rounded-full bg-rose-400 inline-block" />
            <span>Canceladas</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                selectedStatus === AppointmentStatus.CANCELLED ? "bg-white/20 text-white" : "bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200"
              }`}
            >
              {counts[AppointmentStatus.CANCELLED]}
            </span>
          </button>
        </div>

        {/* Controles de Navegación y Pestañas de Vista */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/50">
          {/* Navegación temporal: Hoy, <, >, Título */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToday}
              className="h-8 px-2.5 text-xs font-medium rounded-lg border-border/80 hover:border-primary/50"
            >
              Hoy
            </Button>
            <div className="flex items-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handlePrev}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Periodo anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleNext}
                className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
                aria-label="Periodo siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <span className="text-sm font-semibold text-foreground px-1 select-none">
              {headerDateLabel}
            </span>
          </div>

          {/* Pestañas de alternancia: Mes / Semana / Día */}
          <div className="inline-flex items-center rounded-xl bg-muted/70 p-1 border border-border/40">
            <button
              type="button"
              onClick={() => setView("dia")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                view === "dia"
                  ? "bg-card text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Día
            </button>
            <button
              type="button"
              onClick={() => setView("semana")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                view === "semana"
                  ? "bg-card text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setView("mes")}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                view === "mes"
                  ? "bg-card text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Mes
            </button>
          </div>
        </div>
      </div>

      {/* 3. VISTA CENTRAL: CALENDARIO INTERACTIVO */}
      <Card className="border-border/70 shadow-sm overflow-hidden bg-card">
        <CardContent className="p-0">
          {/* ==================== VISTA: DÍA ==================== */}
          {view === "dia" && (
            <div className="divide-y divide-border/60">
              <div className="p-4 bg-muted/20 flex items-center justify-between border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                    {currentDate.getDate()}
                  </div>
                  <div>
                    <h3 className="font-heading text-base font-semibold text-foreground">
                      {DAYS_OF_WEEK[(currentDate.getDay() + 6) % 7]}, {currentDate.getDate()} de {MONTH_NAMES[currentDate.getMonth()]}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {filteredAppointments.filter((a) => isSameDay(a.startTime, currentDate)).length} citas agendadas para este día
                    </p>
                  </div>
                </div>

                {isSameDay(currentDate, today) && (
                  <Badge className="bg-primary/15 text-primary border-primary/20">
                    Hoy
                  </Badge>
                )}
              </div>

              {/* Time Slots Timeline (08:00 - 19:00) */}
              <div className="divide-y divide-border/40">
                {HOURLY_SLOTS.map((hour) => {
                  const hourLabel = `${hour.toString().padStart(2, "0")}:00`
                  // Appointments in this hour slot
                  const slotAppointments = filteredAppointments.filter((apt) => {
                    const aptDate = apt.startTime
                    return isSameDay(aptDate, currentDate) && aptDate.getHours() === hour
                  })

                  return (
                    <div
                      key={hour}
                      className="grid grid-cols-[70px_1fr] sm:grid-cols-[90px_1fr] min-h-[76px] transition-colors hover:bg-muted/15"
                    >
                      {/* Hour label */}
                      <div className="p-3 text-xs font-medium text-muted-foreground border-r border-border/60 flex items-start justify-end pr-3 select-none">
                        {hourLabel}
                      </div>

                      {/* Hour slot content */}
                      <div className="p-2 sm:p-3 flex flex-col gap-2">
                        {slotAppointments.length > 0 ? (
                          slotAppointments.map((apt) => {
                            const patient = getPatientById(apt.patientId)
                            const status = STATUS_CONFIG[apt.status]
                            const StatusIcon = status.icon

                            return (
                              <button
                                key={apt.id}
                                type="button"
                                onClick={() => setSelectedAppointment(apt)}
                                className={`group text-left p-3 rounded-xl border border-border/60 ${status.bgSoftClass} border-l-4 ${status.borderClass} shadow-2xs hover:shadow-sm hover:border-primary/40 transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-heading font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                                      {patient?.name ?? "Paciente sin nombre"}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${status.badgeClass}`}>
                                      <StatusIcon className="size-3" />
                                      {status.label}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {apt.reason || "Consulta psicológica de seguimiento"}
                                  </p>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="size-3.5 text-muted-foreground" />
                                    <span>
                                      {formatAppointmentTime(apt.startTime)} ({apt.durationMinutes} min)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    {apt.modality === AppointmentModality.VIRTUAL ? (
                                      <span className="inline-flex items-center gap-1 text-primary">
                                        <Video className="size-3.5" />
                                        Virtual
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin className="size-3.5" />
                                        Presencial
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </button>
                            )
                          })
                        ) : (
                          <div className="h-full flex items-center text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors group">
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              <Plus className="size-3" /> Espacio disponible
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ==================== VISTA: SEMANA ==================== */}
          {view === "semana" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 divide-y lg:divide-y-0 lg:divide-x divide-border/60">
              {getWeekDays(currentDate).map((dayDate, dayIdx) => {
                const isCurrentDay = isSameDay(dayDate, today)
                const dayAppointments = filteredAppointments.filter((apt) =>
                  isSameDay(apt.startTime, dayDate)
                )

                return (
                  <div
                    key={dayIdx}
                    className={`flex flex-col min-h-[360px] ${
                      isCurrentDay ? "bg-primary/[0.02]" : "bg-card"
                    }`}
                  >
                    {/* Day Column Header */}
                    <div
                      className={`p-3 border-b border-border/60 flex items-center justify-between ${
                        isCurrentDay ? "bg-primary/10 border-b-primary/30" : "bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`size-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
                            isCurrentDay
                              ? "bg-primary text-primary-foreground shadow-2xs"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {dayDate.getDate()}
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-foreground">
                            {DAYS_OF_WEEK_SHORT[dayIdx]}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {MONTH_NAMES[dayDate.getMonth()].slice(0, 3)}
                          </div>
                        </div>
                      </div>

                      {dayAppointments.length > 0 && (
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-background border border-border/80 text-muted-foreground">
                          {dayAppointments.length}
                        </span>
                      )}
                    </div>

                    {/* Day Appointments List */}
                    <div className="p-2 space-y-2 flex-1">
                      {dayAppointments.length > 0 ? (
                        dayAppointments.map((apt) => {
                          const patient = getPatientById(apt.patientId)
                          const status = STATUS_CONFIG[apt.status]

                          return (
                            <button
                              key={apt.id}
                              type="button"
                              onClick={() => setSelectedAppointment(apt)}
                              className={`w-full text-left p-2.5 rounded-xl border border-border/60 ${status.bgSoftClass} border-l-4 ${status.borderClass} shadow-2xs hover:shadow-sm hover:border-primary/50 transition-all space-y-1.5`}
                            >
                              <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-muted-foreground">
                                <span className="flex items-center gap-1 font-semibold text-foreground">
                                  <Clock className="size-3" />
                                  {formatAppointmentTime(apt.startTime)}
                                </span>
                                {apt.modality === AppointmentModality.VIRTUAL ? (
                                  <span title="Virtual">
                                    <Video className="size-3 text-primary" />
                                  </span>
                                ) : (
                                  <span title="Presencial">
                                    <MapPin className="size-3 text-muted-foreground" />
                                  </span>
                                )}
                              </div>

                              <div className="font-heading font-medium text-xs text-foreground line-clamp-1">
                                {patient?.name ?? "Paciente"}
                              </div>

                              <div className="flex items-center gap-1 text-[10px]">
                                <span className={`size-1.5 rounded-full ${status.dotClass}`} />
                                <span className="text-muted-foreground font-medium">
                                  {status.label}
                                </span>
                              </div>
                            </button>
                          )
                        })
                      ) : (
                        <div className="h-28 flex flex-col items-center justify-center text-center p-3 text-muted-foreground/40">
                          <span className="text-xs">Sin citas</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ==================== VISTA: MES ==================== */}
          {view === "mes" && (
            <div>
              {/* Day names header */}
              <div className="grid grid-cols-7 border-b border-border/60 bg-muted/30 text-center py-2 text-xs font-semibold text-muted-foreground select-none">
                {DAYS_OF_WEEK_SHORT.map((name, i) => (
                  <div key={i}>{name}</div>
                ))}
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-border/60">
                {getMonthDays(currentDate).map(({ date: dayDate, isCurrentMonth }, idx) => {
                  const isCurrentDay = isSameDay(dayDate, today)
                  const dayAppointments = filteredAppointments.filter((apt) =>
                    isSameDay(apt.startTime, dayDate)
                  )

                  return (
                    <div
                      key={idx}
                      className={`min-h-[105px] sm:min-h-[120px] p-1.5 sm:p-2 flex flex-col transition-colors ${
                        !isCurrentMonth
                          ? "bg-muted/20 text-muted-foreground/40"
                          : isCurrentDay
                          ? "bg-primary/[0.03]"
                          : "bg-card hover:bg-muted/10"
                      }`}
                    >
                      {/* Day number cell top */}
                      <div className="flex items-center justify-between mb-1">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentDate(dayDate)
                            setView("dia")
                          }}
                          className={`size-6 rounded-md flex items-center justify-center text-xs font-semibold transition-all ${
                            isCurrentDay
                              ? "bg-primary text-primary-foreground shadow-2xs font-bold"
                              : isCurrentMonth
                              ? "text-foreground hover:bg-muted"
                              : "text-muted-foreground/40"
                          }`}
                          title="Ver este día"
                        >
                          {dayDate.getDate()}
                        </button>

                        {dayAppointments.length > 0 && (
                          <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">
                            {dayAppointments.length} {dayAppointments.length === 1 ? "cita" : "citas"}
                          </span>
                        )}
                      </div>

                      {/* Event Chips */}
                      <div className="space-y-1 flex-1 overflow-y-auto">
                        {dayAppointments.slice(0, 3).map((apt) => {
                          const patient = getPatientById(apt.patientId)
                          const status = STATUS_CONFIG[apt.status]

                          return (
                            <button
                              key={apt.id}
                              type="button"
                              onClick={() => setSelectedAppointment(apt)}
                              className={`w-full text-left px-1.5 py-0.5 rounded-md border text-[11px] truncate flex items-center gap-1 transition-all ${status.badgeClass} hover:opacity-85 shadow-2xs`}
                              title={`${formatAppointmentTime(apt.startTime)} - ${patient?.name ?? "Paciente"}`}
                            >
                              <span className={`size-1.5 rounded-full shrink-0 ${status.dotClass}`} />
                              <span className="font-semibold shrink-0">
                                {formatAppointmentTime(apt.startTime)}
                              </span>
                              <span className="truncate">
                                {patient?.name?.split(" ")[0] ?? "Paciente"}
                              </span>
                            </button>
                          )
                        })}

                        {dayAppointments.length > 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentDate(dayDate)
                              setView("dia")
                            }}
                            className="text-[10px] text-primary font-medium hover:underline pl-1 block text-left"
                          >
                            +{dayAppointments.length - 3} más
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. MODAL DE RESUMEN: Desplegable al hacer clic en una cita */}
      <Dialog
        open={Boolean(selectedAppointment)}
        onOpenChange={(open) => {
          if (!open) setSelectedAppointment(null)
        }}
      >
        <DialogContent className="sm:max-w-md p-6 bg-card border-border/80">
          {selectedAppointment && (() => {
            const patient = getPatientById(selectedAppointment.patientId)
            const status = STATUS_CONFIG[selectedAppointment.status]
            const StatusIcon = status.icon

            return (
              <>
                <DialogHeader className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${status.badgeClass}`}>
                      <StatusIcon className="size-3.5" />
                      {status.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ID: #{selectedAppointment.id}
                    </span>
                  </div>

                  <DialogTitle className="text-xl font-heading font-semibold text-foreground">
                    Resumen de Sesión Clínica
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Detalles programados para la consulta con el paciente.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2 text-sm">
                  {/* Paciente Card */}
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                        {patient?.name
                          ? patient.name
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                          : "P"}
                      </div>
                      <div>
                        <div className="font-heading font-semibold text-foreground text-sm">
                          {patient?.name ?? "Paciente no asignado"}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{patient?.gender === "femenino" ? "Femenino" : "Masculino"}</span>
                          {patient?.phone && <span>· {patient.phone}</span>}
                        </div>
                      </div>
                    </div>

                    {patient?.id && (
                      <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                        <Link href={`/pacientes/${patient.id}`}>
                          Ver Ficha
                        </Link>
                      </Button>
                    )}
                  </div>

                  {/* Horario y Modalidad */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-xl border border-border/60 bg-card space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarIcon className="size-3.5 text-primary" />
                        <span>Fecha y Hora</span>
                      </div>
                      <div className="font-medium text-xs text-foreground">
                        {formatShortDate(selectedAppointment.startTime)}
                      </div>
                      <div className="text-xs font-semibold text-primary">
                        {formatAppointmentTime(selectedAppointment.startTime)} ({selectedAppointment.durationMinutes} min)
                      </div>
                    </div>

                    <div className="p-3 rounded-xl border border-border/60 bg-card space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        {selectedAppointment.modality === AppointmentModality.VIRTUAL ? (
                          <Video className="size-3.5 text-primary" />
                        ) : (
                          <MapPin className="size-3.5 text-primary" />
                        )}
                        <span>Modalidad</span>
                      </div>
                      <div className="font-medium text-xs text-foreground">
                        {selectedAppointment.modality === AppointmentModality.VIRTUAL
                          ? "Consulta Virtual"
                          : "Consulta Presencial"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {selectedAppointment.modality === AppointmentModality.VIRTUAL
                          ? "Enlace en plataforma"
                          : "Consultorio Principal"}
                      </div>
                    </div>
                  </div>

                  {/* Motivo de Consulta */}
                  <div className="p-3 rounded-xl border border-border/60 bg-card space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span>Motivo de Consulta</span>
                    </div>
                    <p className="text-xs text-foreground">
                      {selectedAppointment.reason || "Sin motivo registrado previamente."}
                    </p>
                    {selectedAppointment.notes && (
                      <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-border/40">
                        <span className="font-medium text-foreground">Notas: </span>
                        {selectedAppointment.notes}
                      </p>
                    )}
                  </div>

                  {/* Diagnóstico / Expediente clínico asociado */}
                  <div className="p-3 rounded-xl bg-primary/[0.04] border border-primary/20 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                        Expediente Clínico
                      </div>
                      <div className="text-xs font-medium text-foreground">
                        {MOCK_CLINICAL_RECORD.diagnosis}
                      </div>
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                      Activo
                    </span>
                  </div>
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 border-t border-border/60 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSelectedAppointment(null)}
                    className="w-full sm:w-auto h-9 rounded-xl border-border/80"
                  >
                    Cerrar
                  </Button>
                  {patient?.id && (
                    <Button asChild className="w-full sm:w-auto h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs">
                      <Link href={`/pacientes/${patient.id}`} className="flex items-center gap-1.5">
                        <span>Ver Expediente Completo</span>
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </Button>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* 5. PRÓXIMAS CITAS (TABLA RESUMEN ELEVADA) */}
      <Card className="border-border/70 shadow-sm overflow-hidden bg-card">
        <CardHeader className="border-b border-border/60 bg-muted/10 py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-foreground font-heading">
              Próximas citas programadas
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Listado tabular rápido de sesiones de pacientes
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {filteredAppointments.length} citas filtradas
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border/60 bg-muted/20">
                  <TableHead className="font-semibold text-xs">Paciente</TableHead>
                  <TableHead className="font-semibold text-xs">Fecha</TableHead>
                  <TableHead className="font-semibold text-xs">Hora</TableHead>
                  <TableHead className="font-semibold text-xs">Modalidad</TableHead>
                  <TableHead className="font-semibold text-xs">Estado</TableHead>
                  <TableHead className="font-semibold text-xs text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAppointments.length > 0 ? (
                  filteredAppointments.map((apt) => {
                    const patient = getPatientById(apt.patientId)
                    const status = STATUS_CONFIG[apt.status]

                    return (
                      <TableRow
                        key={apt.id}
                        className="hover:bg-muted/30 transition-colors border-b border-border/40 cursor-pointer"
                        onClick={() => setSelectedAppointment(apt)}
                      >
                        <TableCell className="font-medium text-foreground py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="size-7 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center">
                              {patient?.name?.[0] ?? "P"}
                            </div>
                            <span className="font-heading">{patient?.name ?? "Desconocido"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatShortDate(apt.startTime)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs font-mono">
                          {formatAppointmentTime(apt.startTime)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {apt.modality === AppointmentModality.IN_PERSON ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3 text-muted-foreground" /> Presencial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-primary">
                              <Video className="size-3" /> Virtual
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${status.badgeClass}`}>
                            <span className={`size-1.5 rounded-full ${status.dotClass}`} />
                            {status.label}
                          </span>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAppointment(apt)}
                            className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10 rounded-lg"
                          >
                            Ver detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-sm">
                      No se encontraron citas con los filtros o búsqueda actuales.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
