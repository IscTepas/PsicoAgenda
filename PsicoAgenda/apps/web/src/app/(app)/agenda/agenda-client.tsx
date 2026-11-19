"use client"

import { CobroDeCita } from "@/components/cobro-cita"
import * as React from "react"
import Link from "next/link"
import {
  Calendar as CalendarIcon,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Video,
  MapPin,
  FileText,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Check,
  Loader2,
  Lock,
  Stethoscope,
  DollarSign,
  Wallet,
} from "lucide-react"
import {
  AppointmentStatus,
  AppointmentModality,
  PaymentStatus,
  UserRole,
  type AgendaBlock,
  type Appointment,
  type Patient,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/arc/calendar/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useSession } from "@/lib/use-session"
import { formatAppointmentTime, formatShortDate } from "@/lib/format"
import { LibretaSesionDialog } from "../components/libreta-sesion"
import { citaModificablePorPaciente } from "@/lib/citas"
import { SemanaPorHoras } from "./components/semana-por-horas"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { agendaBlockService, appointmentService, patientService, psychologistService } from "@/services"

type CalendarView = "mes" | "semana" | "dia"

interface StatusConfig {
  label: string
  dotClass: string
  badgeClass: string
  bgSoftClass: string
  icon: React.ComponentType<{ className?: string }>
}

const STATUS_CONFIG: Record<AppointmentStatus, StatusConfig> = {
  [AppointmentStatus.CONFIRMED]: {
    label: "Confirmada",
    dotClass: "bg-primary",
    badgeClass: "bg-primary/10 text-primary border-primary/20",
    bgSoftClass: "bg-primary/[0.04] hover:bg-primary/[0.08]",
    icon: CheckCircle2,
  },
  [AppointmentStatus.PENDING]: {
    label: "Pendiente",
    dotClass: "bg-amber-500",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
    bgSoftClass: "bg-amber-50/50 hover:bg-amber-50/80 dark:bg-amber-950/20",
    icon: AlertCircle,
  },
  [AppointmentStatus.CANCELLED]: {
    label: "Cancelada",
    // Tokens del tema: siguen la paleta elegida y el modo oscuro.
    dotClass: "bg-destructive",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    bgSoftClass: "bg-destructive/[0.04] hover:bg-destructive/[0.08]",
    icon: XCircle,
  },
  [AppointmentStatus.COMPLETED]: {
    label: "Completada",
    dotClass: "bg-muted-foreground/50",
    badgeClass: "bg-muted text-foreground/80 border-border",
    bgSoftClass: "bg-muted/40 hover:bg-muted/60",
    icon: Check,
  },
  [AppointmentStatus.NO_SHOW]: {
    label: "No asistió",
    dotClass: "bg-muted-foreground/50",
    badgeClass: "bg-muted text-foreground/80 border-border",
    bgSoftClass: "bg-muted/40 hover:bg-muted/60",
    icon: HelpCircle,
  },
}

/** Estado de cobro de la cita; espeja `PaymentStatus` de la API. */
const PAYMENT_CONFIG: Record<PaymentStatus, { label: string; badgeClass: string }> = {
  [PaymentStatus.PENDING]: {
    label: "Pago pendiente",
    badgeClass:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  [PaymentStatus.PAID]: {
    label: "Pagado",
    badgeClass:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  [PaymentStatus.WAIVED]: {
    label: "Condonado",
    badgeClass: "bg-muted text-muted-foreground border-border",
  },
}

const DAYS_OF_WEEK = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
const DAYS_OF_WEEK_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
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

/** Fecha local como YYYY-MM-DD (lo que espera el formulario de cita en ?fecha=). */
function toInputDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
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

// La agenda depende de la fecha actual, que el servidor y el navegador no
// siempre comparten; su contenido se pinta ya hidratado para evitar desajustes.
const subscribeNoop = () => () => {}

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/** Un bloqueo toca el día si su intervalo semiabierto se cruza con él. */
function overlapsDay(block: AgendaBlock, day: Date): boolean {
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  return block.startTime.getTime() < dayEnd.getTime() && block.endTime.getTime() > dayStart.getTime()
}

/** Inicio visible del bloqueo en ese día (recortado si empezó antes). */
function blockStartForDay(block: AgendaBlock, day: Date): Date {
  const dayStart = startOfDay(day)
  return block.startTime.getTime() < dayStart.getTime() ? dayStart : block.startTime
}

function blockRangeLabel(block: AgendaBlock): string {
  return `${formatAppointmentTime(block.startTime)} – ${formatAppointmentTime(block.endTime)}`
}

export function AgendaClient() {
  const { user } = useSession()
  const effectiveRole = user?.role ?? (user?.email?.toLowerCase().includes("paciente") ? UserRole.PATIENT : UserRole.PSYCHOLOGIST)
  const isPatient = effectiveRole === UserRole.PATIENT
  const isHydrated = React.useSyncExternalStore(subscribeNoop, () => true, () => false)

  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [patientsById, setPatientsById] = React.useState<Record<string, Patient>>({})
  const [isLoadingData, setIsLoadingData] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [blocks, setBlocks] = React.useState<AgendaBlock[]>([])
  const [blocksError, setBlocksError] = React.useState<string | null>(null)
  const [libretaDe, setLibretaDe] = React.useState<Appointment | null>(null)

  // La API ya acota por rol: un paciente solo recibe sus citas. El cliente no
  // vuelve a filtrar por paciente, solo presenta lo que la sesión puede ver.
  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoadingData(true)
      setLoadError(null)
      try {
        const [appointmentsData, patientsData] = await Promise.all([
          appointmentService.list(),
          patientService.list(),
        ])
        if (cancelled) return
        setAppointments(appointmentsData)
        setPatientsById(Object.fromEntries(patientsData.map((p) => [p.id, p])))
      } catch (error) {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las citas")
      } finally {
        if (!cancelled) setIsLoadingData(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const patientById = React.useCallback((id: string) => patientsById[id], [patientsById])

  const [selectedAppointment, setSelectedAppointment] = React.useState<Appointment | null>(null)

  const baseAppointments = appointments

  const [currentDate, setCurrentDate] = React.useState<Date>(new Date())
  const [view, setView] = React.useState<CalendarView>("semana")
  const [datePickerOpen, setDatePickerOpen] = React.useState(false)
  const router = useRouter()
  const [ahora] = React.useState(() => new Date())
  const { data: horario } = useQuery({
    queryKey: ["horario", "yo"],
    queryFn: () => psychologistService.getMySchedule(),
    enabled: !isPatient,
    staleTime: 5 * 60_000,
  })
  const horarioDeAtencion = React.useMemo(() => {
    const franjas = horario?.slots ?? []
    if (franjas.length === 0) return { inicio: 9, fin: 19 }
    const aHora = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60
    return {
      inicio: Math.floor(Math.min(...franjas.map((f) => aHora(f.startTime)))),
      fin: Math.ceil(Math.max(...franjas.map((f) => aHora(f.endTime)))),
    }
  }, [horario])

  // Rango que se está viendo: los bloqueos se recargan al navegar o cambiar de
  // vista, igual que haría una consulta por periodo.
  const visibleRange = React.useMemo(() => {
    if (view === "dia") {
      const start = startOfDay(currentDate)
      return { start, end: addDays(start, 1) }
    }

    if (view === "semana") {
      const start = getStartOfWeek(currentDate)
      return { start, end: addDays(start, 7) }
    }

    const days = getMonthDays(currentDate)
    const start = startOfDay(days[0].date)
    const end = addDays(startOfDay(days[days.length - 1].date), 1)
    return { start, end }
  }, [view, currentDate])

  React.useEffect(() => {
    let cancelled = false

    agendaBlockService
      .list({ from: visibleRange.start, to: visibleRange.end })
      .then((rows) => {
        if (!cancelled) {
          setBlocks(rows)
          setBlocksError(null)
        }
      })
      .catch((error) => {
        if (cancelled) return
        setBlocks([])
        setBlocksError(
          error instanceof Error ? error.message : "No se pudieron cargar los bloqueos",
        )
      })

    return () => {
      cancelled = true
    }
  }, [visibleRange])

  const today = React.useMemo(() => new Date(), [])

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

  if (!isHydrated || isLoadingData) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="h-[86px] border-b border-border/60" />
        <div className="h-[66px] rounded-2xl border border-border/60 bg-card" />
        <div className="h-[420px] rounded-xl border border-border/70 bg-card" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {loadError && (
        <div role="alert" className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-3">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">{loadError}</p>
        </div>
      )}

      {blocksError && (
        <div role="alert" className="p-4 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center gap-3">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">{blocksError}</p>
        </div>
      )}

      <div className="space-y-4">
      {/* Barra única: dónde estás en el tiempo a la izquierda, qué ver y qué hacer a la derecha. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <h1 className="sr-only">Agenda</h1>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-left text-lg font-semibold tracking-tight sm:text-xl text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40 data-[state=open]:bg-muted"
                aria-label={`${headerDateLabel}. Elegir fecha`}
              >
                {headerDateLabel}
                <ChevronDown className="size-4 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180" aria-hidden="true" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 origin-(--radix-popover-content-transform-origin) p-4">
              <Calendar
                value={currentDate}
                hasMarker={(day) =>
                  baseAppointments.some((apt) => isSameDay(apt.startTime, day)) ||
                  blocks.some((block) => overlapsDay(block, day))
                }
                onChange={(day) => {
                  setCurrentDate(day)
                  setDatePickerOpen(false)
                }}
                showToday
              />
            </PopoverContent>
          </Popover>
          <div className="flex items-center">
            <Button type="button" variant="ghost" size="icon" onClick={handlePrev} className="size-8 rounded-lg text-muted-foreground active:scale-[0.96]" aria-label="Periodo anterior">
              <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={handleNext} className="size-8 rounded-lg text-muted-foreground active:scale-[0.96]" aria-label="Periodo siguiente">
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleToday} className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground active:scale-[0.97]">
            Hoy
          </Button>
          {isLoadingData && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Cargando" />}
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(next) => setView(next as CalendarView)} variant="segment">
            <TabsList aria-label="Vista del calendario" className="bg-muted/70">
              <TabsTrigger value="semana" className="px-3 py-1 text-xs">Semana</TabsTrigger>
              <TabsTrigger value="mes" className="px-3 py-1 text-xs">Mes</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button asChild size="sm" className="h-8 rounded-lg px-3 active:scale-[0.97]">
            <Link href="/agenda/nueva">
              <Plus className="size-4" />
              {isPatient ? "Solicitar cita" : "Nueva cita"}
            </Link>
          </Button>
        </div>
      </div>

      {/* Semana: rejilla por horas. Los huecos libres se tocan para agendar ahí. */}
      {view !== "mes" ? (
        <SemanaPorHoras
          dias={getWeekDays(currentDate)}
          diaActivo={currentDate}
          onDiaActivo={setCurrentDate}
          citas={baseAppointments}
          bloqueos={blocks}
          horario={horarioDeAtencion}
          ahora={ahora}
          nombreDe={(apt) => (isPatient ? (apt.reason || "Sesión") : (patientById(apt.patientId)?.name ?? "Paciente"))}
          onAbrirCita={setSelectedAppointment}
          onHueco={(dia, hora) =>
            router.push(`/agenda/nueva?fecha=${toInputDate(dia)}&hora=${String(hora).padStart(2, "0")}:00`)
          }
          etiquetaHueco={isPatient ? "Solicitar cita" : "Agendar"}
        />
      ) : (
      <Card className="overflow-hidden border-border/60 bg-card shadow-none">
        <CardContent className="p-0">
          {/* ==================== VISTA: MES ==================== */}
          {view === "mes" && (
            <div>
              {/* Day names header */}
              <div className="grid grid-cols-7 border-b border-border/50 px-1 py-2.5 text-xs font-medium text-muted-foreground select-none">
                {DAYS_OF_WEEK_SHORT.map((name, i) => (
                  <div key={i} className="px-2">{name}</div>
                ))}
              </div>

              {/* Month grid */}
              <div className="grid grid-cols-7 auto-rows-fr [&>*]:border-border/40 [&>*:not(:nth-child(7n))]:border-r [&>*:nth-child(n+8)]:border-t">
                {getMonthDays(currentDate).map(({ date: dayDate, isCurrentMonth }, idx) => {
                  const isCurrentDay = isSameDay(dayDate, today)
                  const dayAppointments = baseAppointments.filter(
                    (apt) => isSameDay(apt.startTime, dayDate) && apt.status !== AppointmentStatus.CANCELLED,
                  )
                  const dayBlocks = blocks.filter((block) => overlapsDay(block, dayDate))
                  const dayItems = [
                    ...dayAppointments.map((appointment) => ({
                      kind: "appointment" as const,
                      at: appointment.startTime.getTime(),
                      appointment,
                    })),
                    ...dayBlocks.map((block) => ({
                      kind: "block" as const,
                      at: blockStartForDay(block, dayDate).getTime(),
                      block,
                    })),
                  ].sort((a, b) => a.at - b.at)

                  return (
                    <div
                      key={idx}
                      className={`flex min-h-[84px] flex-col gap-1 p-1.5 sm:min-h-[96px] ${
                        isCurrentDay ? "bg-primary/[0.03]" : ""
                      }`}
                    >
                      {/* Day number cell top */}
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentDate(dayDate)
                            setView("semana")
                          }}
                          className={`flex size-7 items-center justify-center rounded-full text-sm tabular-nums outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 ${
                            isCurrentDay
                              ? "bg-primary font-semibold text-primary-foreground"
                              : isCurrentMonth
                              ? "font-medium text-foreground hover:bg-muted"
                              : "text-muted-foreground/40 hover:bg-muted"
                          }`}
                          aria-label={`Ver el ${dayDate.getDate()} de ${MONTH_NAMES[dayDate.getMonth()]}`}
                          aria-current={isCurrentDay ? "date" : undefined}
                        >
                          {dayDate.getDate()}
                        </button>

                      </div>

                      {/* Citas del día como renglones de texto; las de otro mes, atenuadas. */}
                      <div className={`min-w-0 flex-1 space-y-0.5 ${isCurrentMonth ? "" : "opacity-40"}`}>
                        {dayItems.slice(0, 3).map((item) => {
                          if (item.kind === "block") {
                            const block = item.block

                            return (
                              <div
                                key={`block-${block.id}`}
                                className="flex w-full select-none items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground"
                                title={block.allDay ? "Todo el día · No disponible" : blockRangeLabel(block)}
                              >
                                <Lock className="size-3 shrink-0" />
                                <span className="truncate">
                                  {block.reason ?? "No disponible"}
                                </span>
                              </div>
                            )
                          }

                          const apt = item.appointment
                          const patient = patientById(apt.patientId)
                          const status = STATUS_CONFIG[apt.status]

                          return (
                            <button
                              key={apt.id}
                              type="button"
                              onClick={() => setSelectedAppointment(apt)}
                              className={`flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] outline-none transition-colors hover:bg-muted focus-visible:bg-muted ${
                                apt.status === AppointmentStatus.CANCELLED ? "text-muted-foreground line-through" : "text-foreground"
                              }`}
                              title={`${formatAppointmentTime(apt.startTime)} - ${isPatient ? (apt.reason || "Sesión Terapéutica") : (patient?.name ?? "Paciente")}`}
                            >
                              <span className={`size-1.5 rounded-full shrink-0 ${status.dotClass}`} />
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {/* Con "a.m./p.m.": sin él, una cita de las 6 p.m. se leería como de la mañana. */}
                                {formatAppointmentTime(apt.startTime)}
                              </span>
                              <span className="truncate">
                                {isPatient ? (apt.reason?.split(" ")[0] || "Sesión") : (patient?.name?.split(" ")[0] ?? "Paciente")}
                              </span>
                            </button>
                          )
                        })}

                        {dayItems.length > 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCurrentDate(dayDate)
                              setView("semana")
                            }}
                            className="block rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted"
                          >
                            +{dayItems.length - 3} más
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
      )}
      </div>

      {/* 4. MODAL DE RESUMEN: Desplegable al hacer clic en una cita */}
      <Dialog
        open={Boolean(selectedAppointment)}
        onOpenChange={(open) => {
          if (!open) setSelectedAppointment(null)
        }}
      >
        <DialogContent className="sm:max-w-md p-6 bg-card border-border/80">
          {selectedAppointment && (() => {
            const patient = patientById(selectedAppointment.patientId)
            const status = STATUS_CONFIG[selectedAppointment.status]

            return (
              <>
                <DialogHeader className="space-y-2">
                  <div className="flex items-center justify-between pr-8">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium text-foreground/80">
                      <span className={`size-1.5 rounded-full ${status.dotClass}`} aria-hidden="true" />
                      {status.label}
                    </span>
                  </div>

                  <DialogTitle className="text-xl font-heading font-semibold text-foreground">
                    {isPatient ? "Detalle de tu Sesión Terapéutica" : "Resumen de Sesión Clínica"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    {isPatient ? "Información programada para tu consulta con la psicóloga." : "Detalles programados para la consulta con el paciente."}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2 text-sm">
                  {/* Paciente o Terapeuta Card */}
                  {isPatient ? (
                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm font-heading">
                          <Stethoscope className="size-5" />
                        </div>
                        <div>
                          <div className="font-heading font-semibold text-foreground text-sm">
                            Profesional tratante
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Sesión asignada por tu profesional de salud mental
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                          {patient?.name
                            ? patient.name
                                .split(" ")
                                .map((n: string) => n[0])
                                .slice(0, 2)
                                .join("")
                            : "P"}
                        </div>
                        <div>
                          <div className="font-heading font-semibold text-foreground text-sm">
                            {patient?.name ?? "Paciente no asignado"}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {[
                              patient?.gender && patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1),
                              patient?.phone,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                      </div>

                      {patient?.id && (
                        <div className="flex shrink-0 flex-col items-end">
                          <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-xs">
                            <Link href={`/pacientes/${patient.id}`}>Ver Ficha</Link>
                          </Button>
                          {!isPatient && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={() => setLibretaDe(selectedAppointment)}
                            >
                              Bitácora
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

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

                  {/* Costo de la sesión */}
                  {selectedAppointment.price != null && (
                    <div className="p-3 rounded-xl border border-primary/30 bg-primary/[0.03] flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <DollarSign className="size-3.5 text-primary" />
                        <span>Costo de la sesión</span>
                      </div>
                      <span className="text-sm font-bold text-primary font-heading">
                        ${selectedAppointment.price.toLocaleString("es-MX")}
                      </span>
                    </div>
                  )}

                  {/* Cobro: la psicóloga lo marca o ajusta; el paciente solo ve el estado. */}
                  {!isPatient && (
                    <CobroDeCita
                      key={selectedAppointment.id}
                      cita={selectedAppointment}
                      onActualizada={(updated) => {
                        setAppointments((prev) => prev.map((apt) => (apt.id === updated.id ? updated : apt)))
                        setSelectedAppointment(updated)
                      }}
                    />
                  )}
                  {isPatient && selectedAppointment.payment && (
                    <div className="p-3 rounded-xl border border-border/60 bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Wallet className="size-3.5 text-muted-foreground" />
                          <span>Estado de pago</span>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${PAYMENT_CONFIG[selectedAppointment.payment.status].badgeClass}`}
                        >
                          {PAYMENT_CONFIG[selectedAppointment.payment.status].label}
                        </span>
                      </div>

                      {selectedAppointment.payment.status === PaymentStatus.PAID &&
                        selectedAppointment.payment.paidAt && (
                          <p className="text-[11px] text-muted-foreground">
                            Cobrado el {formatShortDate(selectedAppointment.payment.paidAt)}
                          </p>
                        )}

                    </div>
                  )}

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
                  {(!isPatient || citaModificablePorPaciente(selectedAppointment)) && (
                    <Button asChild variant="outline" className="w-full sm:w-auto h-9 rounded-xl border-border/80">
                      <Link href={`/agenda/${selectedAppointment.id}`}>
                        <span>Modificar cita</span>
                      </Link>
                    </Button>
                  )}
                  {!isPatient && patient?.id && (
                    <Button asChild className="w-full sm:w-auto h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs">
                      <Link href={`/pacientes/${patient.id}`} className="flex items-center gap-1.5">
                        <span>Ver Expediente</span>
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

      {libretaDe && (
        <LibretaSesionDialog
          key={libretaDe.id}
          open
          onOpenChange={(open) => !open && setLibretaDe(null)}
          patientId={libretaDe.patientId}
          patientName={patientById(libretaDe.patientId)?.name}
          appointmentId={libretaDe.id}
          sessionDate={new Date(libretaDe.startTime)}
        />
      )}

    </div>
  )
}
