"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Clock,
  User,
  Search,
  Check,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MapPin,
  Video,
  RefreshCw,
  X,
  FileText,
  Save,
  Plus,
  Loader2,
  DollarSign,
} from "lucide-react"
import {
  AppointmentStatus,
  AppointmentModality,
  AttendanceStatus,
  UserRole,
  calculateAppointmentPrice,
  getEffectiveDurationMinutes,
  type Appointment,
  type Patient,
  type PsychologistSchedule,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { useSession } from "@/lib/use-session"
import { useHydrated } from "@/lib/use-hydrated"
import { Calendar } from "@/components/arc/calendar/calendar"
import {
  addMonths,
  agruparOcupacionPorDia,
  calcularEstadoDia,
  startOfMonth,
  type EstadoDia,
} from "@/lib/calendario"
import {
  addDays,
  calcularEstadoFecha,
  fechaMinimaPara,
  filtrarHorasDisponibles,
  formatDateToInput,
  isSameDay,
  parseInputToDate,
  startOfDay,
  type EstadoFecha,
} from "@/lib/citas"
import {
  appointmentRequestService,
  appointmentService,
  patientService,
  psychologistService,
  type AppointmentOccupancySlot,
} from "@/services"

// Horarios de respaldo mientras carga el horario real desde la BD (Lun–Vie 09:00–19:00).
const FALLBACK_HOURS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
]

const DURATION_OPTIONS = [45, 50, 60]

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
]

const DAYS_NAMES = [
  "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"
]

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

// Mismo estilo de estado que el panel y la agenda: pastilla gris + punto de color.
const STATUS_PILL: Record<AppointmentStatus, { label: string; dot: string }> = {
  [AppointmentStatus.CONFIRMED]: { label: "Confirmada", dot: "bg-primary" },
  [AppointmentStatus.PENDING]: { label: "Pendiente", dot: "bg-amber-500" },
  [AppointmentStatus.CANCELLED]: { label: "Cancelada", dot: "bg-destructive" },
  [AppointmentStatus.COMPLETED]: { label: "Completada", dot: "bg-muted-foreground/50" },
  [AppointmentStatus.NO_SHOW]: { label: "No asistió", dot: "bg-muted-foreground/50" },
}

// Colores del preview de la fecha según la disponibilidad real del día.
const ESTADO_FECHA_ESTILO: Record<
  EstadoFecha,
  { caja: string; icono: string; chip: string; punto: string }
> = {
  "sin-fecha": {
    caja: "bg-muted/30 border-border/50",
    icono: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    punto: "bg-muted-foreground/50",
  },
  consultando: {
    caja: "bg-muted/30 border-border/50",
    icono: "text-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    punto: "bg-muted-foreground/50 animate-pulse",
  },
  "no-permitida": {
    caja: "bg-destructive/[0.05] border-destructive/30",
    icono: "text-destructive",
    chip: "bg-destructive/10 text-destructive",
    punto: "bg-destructive",
  },
  "sin-horario": {
    caja: "bg-destructive/[0.05] border-destructive/30",
    icono: "text-destructive",
    chip: "bg-destructive/10 text-destructive",
    punto: "bg-destructive",
  },
  lleno: {
    caja: "bg-amber-500/[0.08] border-amber-500/40",
    icono: "text-amber-600 dark:text-amber-400",
    chip: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    punto: "bg-amber-500",
  },
  disponible: {
    caja: "bg-primary/[0.06] border-primary/40",
    icono: "text-primary",
    chip: "bg-primary/10 text-primary",
    punto: "bg-primary",
  },
}

function etiquetaEstadoFecha(estado: EstadoFecha, horasLibres: number): string {
  switch (estado) {
    case "sin-fecha":
      return "Sin fecha"
    case "consultando":
      return "Consultando…"
    case "no-permitida":
      return "Fecha no permitida"
    case "sin-horario":
      return "Sin horario"
    case "lleno":
      return "Día completo"
    case "disponible":
      return horasLibres === 1 ? "1 horario libre" : `${horasLibres} horarios libres`
  }
}

function formatearDiaHora(fecha: Date): string {
  return `${DAYS_NAMES[fecha.getDay()]} ${fecha.getDate()} de ${MONTH_NAMES[fecha.getMonth()]} a las ${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`
}

function formatearDiaCorto(fecha: Date): string {
  return fecha.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
}

interface AppointmentFormProps {
  initialAppointment?: Appointment | null
}

function AppointmentFormInner({ initialAppointment }: AppointmentFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isEdit = Boolean(initialAppointment)

  const { user } = useSession()
  const effectiveRole = user?.role ?? (user?.email?.toLowerCase().includes("paciente") ? UserRole.PATIENT : UserRole.PSYCHOLOGIST)
  const isPatient = effectiveRole === UserRole.PATIENT

  // Datos reales de la API. `patients` es el directorio visible según el rol: el
  // psicólogo ve todos; un paciente, solo su propio registro.
  const [patients, setPatients] = React.useState<Patient[]>([])
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [dayAppointmentsLoading, setDayAppointmentsLoading] = React.useState(false)
  const [isLoadingData, setIsLoadingData] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoadingData(true)
      setLoadError(null)
      try {
        const data = await patientService.list()
        if (!cancelled) setPatients(data)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "No se pudieron cargar los pacientes")
        }
      } finally {
        if (!cancelled) setIsLoadingData(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // Pre-selected patient from props or query param. El paciente queda fijado a su
  // propio registro cuando el directorio carga.
  const paramPatientId = searchParams.get("patientId")
  const defaultPatientId = initialAppointment?.patientId || paramPatientId || ""

  // Form State
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>(defaultPatientId)
  const [patientSearch, setPatientSearch] = React.useState<string>("")
  const [isPatientDropdownOpen, setIsPatientDropdownOpen] = React.useState<boolean>(false)

  // Date and Time State. Desde la agenda se puede llegar con ?fecha=AAAA-MM-DD&hora=HH:00
  // (al tocar un hueco libre), así que esos valores precargan el formulario. Sin
  // esos datos la fecha queda vacía a propósito: no se sugiere un día.
  const paramDate = searchParams.get("fecha")
  const paramHour = searchParams.get("hora")
  const initialDate: Date | null = initialAppointment?.startTime
    ? new Date(initialAppointment.startTime)
    : paramDate && /^\d{4}-\d{2}-\d{2}$/.test(paramDate)
      ? parseInputToDate(paramDate)
      : null
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(initialDate)

  const initialHour = initialAppointment?.startTime
    ? `${String(initialAppointment.startTime.getHours()).padStart(2, "0")}:00`
    : paramHour && FALLBACK_HOURS.includes(paramHour)
      ? paramHour
      : ""
  const [selectedHour, setSelectedHour] = React.useState<string>(initialHour)
  const [durationMinutes, setDurationMinutes] = React.useState<number>(initialAppointment?.durationMinutes || 50)
  const [modality, setModality] = React.useState<AppointmentModality | null>(
    initialAppointment?.modality ?? null
  )
  const [reason, setReason] = React.useState<string>(initialAppointment?.reason || "")

  // Existing Appointment Status State
  const [status, setStatus] = React.useState<AppointmentStatus>(
    initialAppointment?.status || AppointmentStatus.CONFIRMED
  )
  const [attendance, setAttendance] = React.useState<AttendanceStatus | undefined>(
    initialAppointment?.attendanceStatus
  )

  // Cancellation Modal State
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState<boolean>(false)
  const [cancellationReason, setCancellationReason] = React.useState<string>("")
  const [cancelError, setCancelError] = React.useState<string>("")

  // Reagendamiento del paciente: el envío abre una confirmación y, al aceptar,
  // se cancela la cita actual y se crea la solicitud en una sola llamada.
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = React.useState<boolean>(false)
  const [rescheduleDraft, setRescheduleDraft] = React.useState<{
    startTime: Date
    durationMinutes: number
    modality: AppointmentModality
    reason?: string
  } | null>(null)

  // Form feedback state
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false)

  // Today check
  const today = React.useMemo(() => new Date(), [])
  const hydrated = useHydrated()
  const isAppointmentToday = React.useMemo(() => {
    if (!hydrated || !initialAppointment) return false
    const start = toDate(initialAppointment.startTime)
    return start ? isSameDay(start, today) : false
  }, [initialAppointment, today, hydrated])

  // Instante de referencia para las reglas de fecha. Se refresca al cambiar la
  // fecha para que las franjas de hoy no se queden viejas mientras se elige.
  const [ahora, setAhora] = React.useState<Date>(() => new Date())
  const minimaFecha = React.useMemo(
    () => fechaMinimaPara({ esEdicion: isEdit, ahora }),
    [isEdit, ahora],
  )
  // Ventana de agenda: el tercer mes visible (máximo 90 días desde hoy). La
  // edición conserva la fecha de la cita aunque quede fuera de esa ventana.
  const maximaFecha = React.useMemo(() => {
    if (isEdit) return null
    return startOfDay(addDays(addMonths(startOfMonth(ahora), 3), -1))
  }, [isEdit, ahora])
  // La fecha elegida se ajusta al rango permitido (mínimo hoy, máximo 90 días).
  const selectedDateEfectiva = React.useMemo(() => {
    if (!selectedDate) return null
    if (!hydrated) return selectedDate

    const dia = startOfDay(selectedDate).getTime()
    if (minimaFecha && dia < minimaFecha.getTime()) return minimaFecha
    if (maximaFecha && dia > maximaFecha.getTime()) return maximaFecha
    return selectedDate
  }, [selectedDate, minimaFecha, maximaFecha, hydrated])
  // El paciente autenticado solo puede agendarse a sí mismo: el directorio visible
  // para él contiene únicamente su registro, así que la selección se deriva en vez
  // de sincronizarse por efecto.
  const lockedPatientId = isPatient ? (patients[0]?.id ?? "") : selectedPatientId

  // Citas del día seleccionado: alimentan el mapa de disponibilidad horaria. Se
  // piden acotadas por fecha para no traer la agenda completa.
  React.useEffect(() => {
    if (!selectedDateEfectiva) return

    let cancelled = false

    const load = async () => {
      setDayAppointmentsLoading(true)

      const start = new Date(selectedDateEfectiva)
      start.setHours(0, 0, 0, 0)
      const end = new Date(selectedDateEfectiva)
      end.setHours(23, 59, 59, 999)

      try {
        const data = await appointmentService.list({ from: start, to: end })
        if (!cancelled) setAppointments(data)
      } catch {
        if (!cancelled) setAppointments([])
      } finally {
        if (!cancelled) setDayAppointmentsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [selectedDateEfectiva])

  // Selected Patient Object
  const selectedPatient = React.useMemo(() => {
    return patients.find((p) => p.id === lockedPatientId)
  }, [patients, lockedPatientId])

  // Horario semanal real del profesional, servido por la API desde
  // `horarios_psicologo` (si la tabla está vacía, la API inserta los precargados).
  // `undefined` = cargando; `null` = no se pudo cargar (se usa el respaldo).
  const [schedule, setSchedule] = React.useState<PsychologistSchedule | null | undefined>(undefined)

  React.useEffect(() => {
    const psychologistId = isPatient ? patients[0]?.psychologistId : undefined
    // El psicólogo agenda sobre su propio horario; el paciente, sobre el de su
    // profesional asignado.
    if (!isPatient && !user) return
    if (isPatient && !psychologistId) return

    let cancelled = false
    const request = isPatient
      ? psychologistService.getSchedule(psychologistId!)
      : psychologistService.getMySchedule()

    request
      .then((data) => {
        if (!cancelled) setSchedule(data)
      })
      .catch(() => {
        if (!cancelled) setSchedule(null)
      })

    return () => {
      cancelled = true
    }
  }, [isPatient, patients, user])

  // Ocupación de la agenda para los meses visibles del calendario. La API
  // devuelve solo rangos ocupados del psicólogo (sin datos del paciente).
  const [ocupacion, setOcupacion] = React.useState<AppointmentOccupancySlot[]>([])
  // El calendario muestra un mes a la vez; la ocupación se carga para el mes visible.
  const [mesVisible, setMesVisible] = React.useState<Date | null>(null)
  const mesMostrado = mesVisible ?? startOfMonth(selectedDateEfectiva ?? minimaFecha ?? ahora)
  const mesMostradoTime = mesMostrado.getTime()
  const rangoOcupacion = React.useMemo(() => {
    if (!hydrated) return null
    const inicio = new Date(mesMostradoTime)
    return { from: inicio.toISOString(), to: addMonths(inicio, 1).toISOString() }
  }, [hydrated, mesMostradoTime])

  React.useEffect(() => {
    if (!rangoOcupacion) return

    let cancelled = false

    const load = async () => {
      try {
        const data = await appointmentService.getOccupancy({
          from: new Date(rangoOcupacion.from),
          to: new Date(rangoOcupacion.to),
        })
        if (!cancelled) setOcupacion(data)
      } catch {
        if (!cancelled) setOcupacion([])
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [rangoOcupacion])

  // Horas de atención de un día concreto según el horario semanal.
  const horasDelDiaPara = React.useCallback(
    (fecha: Date): string[] => {
      if (schedule === undefined) return []
      const jsDay = fecha.getDay()
      const dbDay = jsDay === 0 ? 7 : jsDay

      if (schedule === null) {
        return dbDay >= 1 && dbDay <= 5 ? FALLBACK_HOURS : []
      }

      return Array.from(
        new Set(
          schedule.slots
            .filter((slot) => slot.dayOfWeek === dbDay)
            .map((slot) => slot.startTime),
        ),
      ).sort()
    },
    [schedule],
  )

  const ocupadosPorDia = React.useMemo(
    () => agruparOcupacionPorDia(ocupacion),
    [ocupacion],
  )

  const estadoDia = React.useCallback(
    (fecha: Date): EstadoDia => {
      if (!hydrated || schedule === undefined) return "disabled"
      return calcularEstadoDia({
        fecha,
        hoy: ahora,
        minima: minimaFecha,
        maxima: maximaFecha,
        horasDelDia: horasDelDiaPara(fecha),
        horasOcupadas: ocupadosPorDia.get(formatDateToInput(fecha)) ?? new Set<string>(),
        ahora,
      })
    },
    [hydrated, schedule, ahora, minimaFecha, maximaFecha, horasDelDiaPara, ocupadosPorDia],
  )

  // Franjas del día según el horario de la BD, sin filtrar por hora.
  // JS: 0 = domingo..6 = sábado; BD: 1 = lunes..7 = domingo.
  const horasDelDia = React.useMemo(() => {
    if (!selectedDateEfectiva) return []
    if (!schedule) return FALLBACK_HOURS
    const jsDay = selectedDateEfectiva.getDay()
    const dbDay = jsDay === 0 ? 7 : jsDay
    const hours = schedule.slots
      .filter((slot) => slot.dayOfWeek === dbDay)
      .map((slot) => slot.startTime)
    return Array.from(new Set(hours)).sort()
  }, [schedule, selectedDateEfectiva])

  // La franja de la cita que se edita se mantiene visible aunque ya haya pasado.
  const horaEnEdicion = React.useMemo(() => {
    if (!isEdit || !initialAppointment?.startTime) return undefined
    return `${String(toDate(initialAppointment.startTime).getHours()).padStart(2, "0")}:00`
  }, [isEdit, initialAppointment])

  // Franjas vigentes: si la fecha es hoy se ocultan las horas que ya pasaron.
  const availableHours = React.useMemo(
    () =>
      selectedDateEfectiva
        ? filtrarHorasDisponibles(horasDelDia, selectedDateEfectiva, ahora, horaEnEdicion)
        : [],
    [horasDelDia, selectedDateEfectiva, ahora, horaEnEdicion],
  )

  // Slot Availability Map for the selected date
  const slotAvailability = React.useMemo(() => {
    const map: Record<string, { available: boolean; conflictWith?: string }> = {}
    if (!selectedDateEfectiva) return map

    availableHours.forEach((hourStr) => {
      const hourNum = parseInt(hourStr.split(":")[0], 10)
      const existing = appointments.find((apt) => {
        const aptDate = toDate(apt.startTime)
        const sameSlot =
          aptDate &&
          isSameDay(aptDate, selectedDateEfectiva) &&
          aptDate.getHours() === hourNum &&
          apt.status !== AppointmentStatus.CANCELLED

        // El psicólogo conserva la franja de la cita que edita; el paciente que
        // reagenda no puede volver a elegir la misma.
        if (apt.id === initialAppointment?.id) {
          return isEdit && isPatient && Boolean(sameSlot)
        }

        return Boolean(sameSlot)
      })

      if (existing) {
        const patient = patients.find((p) => p.id === existing.patientId)
        map[hourStr] = {
          available: false,
          conflictWith:
            existing.id === initialAppointment?.id
              ? "Tu cita actual"
              : patient?.name || "Cita ocupada",
        }
      } else {
        map[hourStr] = { available: true }
      }
    })

    return map
  }, [appointments, patients, selectedDateEfectiva, isEdit, isPatient, initialAppointment, availableHours])

  // Hora realmente elegida: sin valor por defecto. Solo cuenta la hora que la
  // persona tocó y que sigue libre en el día seleccionado.
  const selectedHourEfectivo = React.useMemo(() => {
    if (!selectedDateEfectiva) return ""
    const estaLibre = (hora: string) => slotAvailability[hora]?.available ?? false
    return availableHours.includes(selectedHour) && estaLibre(selectedHour)
      ? selectedHour
      : ""
  }, [selectedDateEfectiva, availableHours, selectedHour, slotAvailability])

  // El formulario está completo cuando hay paciente, fecha y una franja libre.
  const formularioCompleto =
    Boolean(lockedPatientId) &&
    Boolean(selectedDateEfectiva) &&
    Boolean(selectedHourEfectivo) &&
    Boolean(modality) &&
    availableHours.includes(selectedHourEfectivo) &&
    (slotAvailability[selectedHourEfectivo]?.available ?? false) &&
    !dayAppointmentsLoading

  // Primer día futuro con franjas en el horario del profesional: se sugiere
  // cuando la fecha elegida no tiene disponibilidad (p. ej. un sábado).
  const nextAvailableDate = React.useMemo(() => {
    if (!schedule || !selectedDateEfectiva || availableHours.length > 0) return null
    for (let i = 1; i <= 30; i++) {
      const candidate = addDays(selectedDateEfectiva, i)
      if (maximaFecha && startOfDay(candidate).getTime() > maximaFecha.getTime()) return null
      const jsDay = candidate.getDay()
      const dbDay = jsDay === 0 ? 7 : jsDay
      if (schedule.slots.some((slot) => slot.dayOfWeek === dbDay)) return candidate
    }
    return null
  }, [schedule, selectedDateEfectiva, availableHours, maximaFecha])

  // El paciente seleccionado es menor de edad: la sesión se fija en 30 min.
  const isMinorPatient = React.useMemo(() => {
    const birth = selectedPatient?.birthDate
    if (!birth) return false
    const birthDate = toDate(birth)
    const cutoff = new Date()
    cutoff.setFullYear(cutoff.getFullYear() - 18)
    return birthDate > cutoff
  }, [selectedPatient])

  // Duración efectiva: 30 minutos para menores. También se deriva (en vez de
  // sincronizar el estado con un efecto) para que el selector, la vista previa
  // y el payload coincidan siempre.
  const durationMinutesEfectivos = getEffectiveDurationMinutes(isMinorPatient, durationMinutes)

  // Costo de la sesión calculado en vivo con las mismas reglas del backend.
  const previewPrice = React.useMemo(() => {
    if (!hydrated || !selectedDateEfectiva || !selectedHourEfectivo || !modality) return null
    const [hour, minute] = selectedHourEfectivo.split(":").map(Number)
    const start = new Date(selectedDateEfectiva)
    start.setHours(hour, minute, 0, 0)
    return calculateAppointmentPrice({
      isMinor: isMinorPatient,
      startTime: start,
      modality,
      durationMinutes: durationMinutesEfectivos,
    })
  }, [hydrated, selectedDateEfectiva, selectedHourEfectivo, isMinorPatient, durationMinutesEfectivos, modality])

  // Autocomplete patient filter
  const filteredPatients = React.useMemo(() => {
    if (!patientSearch.trim()) return patients
    const q = patientSearch.toLowerCase().trim()
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.phone && p.phone.includes(q))
    )
  }, [patients, patientSearch])

  // Estado del preview: verde si hay franjas libres, ámbar si el día está lleno
  // y rojo si el día no tiene horario o la fecha no está permitida.
  const horasLibres = React.useMemo(
    () => availableHours.filter((hora) => slotAvailability[hora]?.available ?? false).length,
    [availableHours, slotAvailability],
  )

  const estadoDeFecha = React.useMemo(
    () =>
      calcularEstadoFecha({
        fecha: selectedDateEfectiva,
        horasDelDia,
        horasDisponibles: availableHours,
        horasOcupadas: new Set(
          availableHours.filter((hora) => !(slotAvailability[hora]?.available ?? false)),
        ),
        cargando: schedule === undefined || dayAppointmentsLoading,
        minima: hydrated ? minimaFecha : null,
      }),
    [
      selectedDateEfectiva,
      horasDelDia,
      availableHours,
      slotAvailability,
      schedule,
      dayAppointmentsLoading,
      hydrated,
      minimaFecha,
    ],
  )

  const estadoFechaEstilo = ESTADO_FECHA_ESTILO[estadoDeFecha]
  const estadoFechaEtiqueta = etiquetaEstadoFecha(estadoDeFecha, horasLibres)

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!lockedPatientId) {
      setErrorMessage("Por favor selecciona un paciente antes de continuar.")
      return
    }

    if (!selectedDateEfectiva) {
      setErrorMessage("Por favor selecciona una fecha válida.")
      return
    }

    if (minimaFecha && startOfDay(selectedDateEfectiva).getTime() < minimaFecha.getTime()) {
      setErrorMessage("Elige una fecha válida.")
      return
    }

    if (maximaFecha && startOfDay(selectedDateEfectiva).getTime() > maximaFecha.getTime()) {
      setErrorMessage("Elige una fecha dentro de los próximos 3 meses.")
      return
    }

    if (!selectedHourEfectivo) {
      setErrorMessage("Por favor selecciona una hora para la sesión.")
      return
    }

    if (!availableHours.includes(selectedHourEfectivo)) {
      setErrorMessage("El día seleccionado no tiene franjas horarias disponibles. Elige otra fecha.")
      return
    }

    // Check slot availability
    const slot = slotAvailability[selectedHourEfectivo]
    if (slot && !slot.available) {
      setErrorMessage(`El horario de las ${selectedHourEfectivo} ya se encuentra ocupado por ${slot.conflictWith}.`)
      return
    }

    if (!modality) {
      setErrorMessage("Selecciona la modalidad de la sesión.")
      return
    }

    const [hour, minute] = selectedHourEfectivo.split(":").map(Number)
    const startTime = new Date(selectedDateEfectiva)
    startTime.setHours(hour, minute, 0, 0)

    if (startTime.getTime() <= Date.now()) {
      setErrorMessage("Elige un horario en el futuro.")
      return
    }

    // El paciente reagenda: se confirma y la API cancela la cita actual + crea
    // la solicitud en una sola transacción.
    if (isEdit && isPatient && initialAppointment) {
      if (startTime.getTime() === toDate(initialAppointment.startTime).getTime()) {
        setErrorMessage("Elige un horario distinto al actual.")
        return
      }

      setRescheduleDraft({
        startTime,
        durationMinutes: durationMinutesEfectivos,
        modality,
        reason: reason || undefined,
      })
      setIsRescheduleModalOpen(true)
      return
    }

    setIsSubmitting(true)
    try {
      if (isEdit && initialAppointment) {
        await appointmentService.update(initialAppointment.id, {
          startTime,
          durationMinutes: durationMinutesEfectivos,
          modality,
          reason: reason || undefined,
        })

        // El estado administrativo viaja por su propio endpoint; solo se llama si
        // el usuario lo cambió respecto a la cita original.
        if (status !== initialAppointment.status && status !== AppointmentStatus.CANCELLED) {
          await appointmentService.changeStatus(initialAppointment.id, status)
        }

        setSuccessMessage("¡Cita actualizada exitosamente!")
      } else if (isPatient) {
        // El paciente no agenda: solicita. La cita existe cuando el psicólogo acepta.
        await appointmentRequestService.create({
          startTime,
          durationMinutes: durationMinutesEfectivos,
          modality,
          reason: reason || undefined,
        })
        setSuccessMessage("Solicitud enviada. Te avisaremos cuando tu psicólogo la confirme.")
      } else {
        await appointmentService.create({
          patientId: lockedPatientId,
          startTime,
          durationMinutes: durationMinutesEfectivos,
          modality,
          reason: reason || undefined,
        })
        setSuccessMessage("¡Cita agendada exitosamente!")
      }

      setTimeout(() => {
        router.push(isPatient ? "/dashboard" : "/agenda")
      }, 900)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar la cita")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Confirmación del reagendamiento del paciente.
  const handleConfirmReschedule = async () => {
    const draft = rescheduleDraft
    if (!draft || !initialAppointment) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await appointmentRequestService.reschedule({
        appointmentId: initialAppointment.id,
        ...draft,
      })
      setIsRescheduleModalOpen(false)
      setSuccessMessage("Solicitud de reagendamiento enviada. Tu cita anterior fue cancelada.")
      setTimeout(() => router.push("/dashboard"), 900)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo reagendar la cita")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Confirm Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellationReason.trim()) {
      setCancelError("Debes especificar un motivo para cancelar la cita.")
      return
    }

    if (!initialAppointment) return

    setIsSubmitting(true)
    try {
      await appointmentService.cancel(initialAppointment.id, cancellationReason.trim())
      setStatus(AppointmentStatus.CANCELLED)
      setIsCancelModalOpen(false)
      setSuccessMessage("La cita ha sido cancelada correctamente.")
      setTimeout(() => {
        router.push("/agenda")
      }, 1100)
    } catch (error) {
      setCancelError(error instanceof Error ? error.message : "No se pudo cancelar la cita")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Attendance Registration
  const handleRecordAttendance = async (attended: boolean) => {
    if (!initialAppointment) return

    const nextStatus = attended ? AppointmentStatus.COMPLETED : AppointmentStatus.NO_SHOW

    setIsSubmitting(true)
    try {
      await appointmentService.changeStatus(initialAppointment.id, nextStatus)
      setAttendance(attended ? AttendanceStatus.ATTENDED : AttendanceStatus.NO_SHOW)
      setStatus(nextStatus)
      setSuccessMessage(
        attended
          ? "Asistencia registrada: Paciente asistió a la sesión."
          : "Asistencia registrada: Paciente no asistió.",
      )
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo registrar la asistencia")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header and Back Link */}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          asChild
          className="w-fit -ml-2 text-muted-foreground hover:text-foreground rounded-lg"
        >
          <Link href="/agenda" className="flex items-center gap-1.5">
            <ArrowLeft className="size-4" />
            <span>Volver a la Agenda</span>
          </Link>
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-heading">
              {isEdit
                ? isPatient
                  ? "Reagendar cita"
                  : "Modificar cita"
                : isPatient
                  ? "Solicitar Cita"
                  : "Agendar Nueva Cita"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? isPatient
                  ? "Elige un nuevo horario. Tu cita actual se cancelará al enviar la solicitud."
                  : "Ajusta la fecha, la hora o los datos de la sesión."
                : isPatient
                  ? "Elige fecha, hora y modalidad. Tu psicólogo confirmará la solicitud."
                  : "Programa una nueva consulta clínica definiendo paciente, fecha, hora y modalidad."}
            </p>
          </div>

          {/* Estado de la cita (solo visible si la cita ya existe) */}
          {isEdit && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Estado actual:</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium text-foreground/80">
                <span className={`size-1.5 rounded-full ${STATUS_PILL[status].dot}`} aria-hidden="true" />
                {STATUS_PILL[status].label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Success / Error Alerts */}
      {successMessage && (
        <div role="status" className="p-4 rounded-xl bg-primary/10 text-foreground border border-primary/20 flex items-center gap-3 animate-in fade-in-50">
          <CheckCircle2 className="size-5 text-primary shrink-0" />
          <p className="text-sm font-medium">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-3 animate-in fade-in-50">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">{errorMessage}</p>
        </div>
      )}

      {loadError && (
        <div role="alert" className="p-4 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-3 animate-in fade-in-50">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm font-medium">{loadError}</p>
        </div>
      )}

      {isLoadingData && !loadError && (
        <p className="text-xs text-muted-foreground">Cargando datos de la agenda…</p>
      )}

      {/* SECCIÓN DESTACADA: REGISTRAR ASISTENCIA (Solo si es el día de la cita y no es paciente) */}
      {isAppointmentToday && isEdit && status !== AppointmentStatus.CANCELLED && !isPatient && (
        <Card className="border-primary/30 bg-primary/[0.03] shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                <CardTitle className="text-base font-semibold text-primary font-heading">
                  Cita programada para hoy
                </CardTitle>
              </div>
              {attendance && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary">
                  {attendance === AttendanceStatus.ATTENDED ? "Asistencia Confirmada" : "Inasistencia Notificada"}
                </span>
              )}
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Puedes registrar el estado de asistencia de la consulta de hoy con un solo clic.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={() => handleRecordAttendance(true)}
              disabled={isSubmitting}
              className={`h-9 rounded-xl text-xs font-medium gap-1.5 ${
                attendance === AttendanceStatus.ATTENDED
                  ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              <CheckCircle2 className="size-4" />
              <span>Registrar Asistencia (Asistió)</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleRecordAttendance(false)}
              disabled={isSubmitting}
              className={`h-9 rounded-xl text-xs font-medium gap-1.5 ${
                attendance === AttendanceStatus.NO_SHOW
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border/80 hover:bg-muted"
              }`}
            >
              <XCircle className="size-4 text-muted-foreground" />
              <span>Marcar como No Asistió</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CARD 1: SELECCIÓN DEL PACIENTE (solo psicólogo/admin; el paciente ya sabe quién es) */}
        {!isPatient && (
        // overflow-visible: la lista de resultados sale por debajo de la tarjeta; el Card la recortaba.
        <Card className="overflow-visible border-border/70 shadow-2xs bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
              <User className="size-4 text-primary" />
              <span>1. Paciente de la Consulta</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Busca o selecciona el paciente asignado para esta sesión clínica.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            {selectedPatient ? (
              // Selected Patient Card View
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/[0.02] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm shadow-2xs">
                    {selectedPatient.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <div>
                    <div className="font-heading font-semibold text-foreground text-sm flex items-center gap-2">
                      <span>{selectedPatient.name}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {selectedPatient.isMinor ? "Menor de edad" : "Adulto"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-3 mt-0.5">
                      <span>{selectedPatient.email}</span>
                      {selectedPatient.phone && <span>· {selectedPatient.phone}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPatientId("")
                      setPatientSearch("")
                      setIsPatientDropdownOpen(true)
                    }}
                    className="h-8 text-xs rounded-lg border-border/80 hover:border-primary/50"
                  >
                    <RefreshCw className="size-3.5 mr-1 text-muted-foreground" />
                    Cambiar paciente
                  </Button>
                  <Button variant="ghost" size="sm" asChild className="h-8 text-xs text-primary">
                    <Link href={`/pacientes/${selectedPatient.id}`} target="_blank">
                      Ver expediente
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              // Autocomplete Search Input: se cierra al salir el foco del buscador o con Escape
              <div
                className="relative"
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsPatientDropdownOpen(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setIsPatientDropdownOpen(false)
                }}
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder="Escribe el nombre, correo o teléfono del paciente..."
                    value={patientSearch}
                    disabled={isLoadingData}
                    onChange={(e) => {
                      setPatientSearch(e.target.value)
                      setIsPatientDropdownOpen(true)
                    }}
                    onFocus={() => setIsPatientDropdownOpen(true)}
                    role="combobox"
                    aria-expanded={isPatientDropdownOpen}
                    aria-controls="patient-search-results"
                    aria-autocomplete="list"
                    className="pl-9 pr-9 h-11 text-sm rounded-xl border-border/80 focus-visible:ring-primary/20"
                  />
                  {isLoadingData && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
                  )}
                  {patientSearch && !isLoadingData && (
                    <button
                      type="button"
                      onClick={() => setPatientSearch("")}
                      aria-label="Borrar búsqueda"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown Results */}
                {isPatientDropdownOpen && (
                  <div
                    id="patient-search-results"
                    role="listbox"
                    className="absolute z-30 mt-1 w-full rounded-xl border border-border/80 bg-card p-1 shadow-lg max-h-60 overflow-y-auto overscroll-contain"
                  >
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          role="option"
                          aria-selected={false}
                          // Evita que el input pierda el foco antes del clic (Safari no enfoca botones).
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setSelectedPatientId(patient.id)
                            setIsPatientDropdownOpen(false)
                            setPatientSearch("")
                          }}
                          className="w-full text-left p-2.5 rounded-lg hover:bg-muted/60 transition-colors flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center">
                              {patient.name[0]}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                {patient.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {patient.email} {patient.phone ? `· ${patient.phone}` : ""}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            Seleccionar →
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-xs text-muted-foreground">
                        No se encontraron pacientes coincidentes con &quot;{patientSearch}&quot;.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* FECHA Y HORA: calendario a la izquierda y horarios del día a la derecha (apilados en móvil) */}
        <Card className="border-border/70 shadow-2xs bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
              <CalendarIcon className="size-4 text-primary" />
              <span>{isPatient ? "1." : "2."} Fecha y Hora</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Elige un día dentro de los próximos 3 meses y después un horario libre. Los días con citas llevan un punto; los llenos o sin horario aparecen atenuados.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-0">
            {/* Calendario */}
            <div className="md:pr-6">
              {hydrated ? (
                <Calendar
                  className="mx-auto md:mx-0"
                  value={selectedDateEfectiva ?? undefined}
                  month={mesMostrado}
                  onMonthChange={setMesVisible}
                  onChange={(fecha) => {
                    setAhora(new Date())
                    setSelectedDate(fecha)
                    setSelectedHour("")
                  }}
                  minDate={minimaFecha ?? undefined}
                  maxDate={maximaFecha ?? undefined}
                  disabledDates={(fecha) => {
                    const estado = estadoDia(fecha)
                    return estado === "full" || estado === "no-schedule" || estado === "disabled"
                  }}
                  hasMarker={(fecha) => estadoDia(fecha) === "partial"}
                  showToday
                />
              ) : (
                <div className="h-64 animate-pulse rounded-xl bg-muted/30" aria-hidden="true" />
              )}
            </div>

            {/* Horarios del día elegido: ocupa toda la altura del calendario */}
            <div className="@container flex min-w-0 flex-col gap-4 border-t border-border/50 pt-6 md:border-t-0 md:border-l md:pt-0 md:pl-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="size-4 text-primary" />
                  {selectedDateEfectiva
                    ? <span>{DAYS_NAMES[selectedDateEfectiva.getDay()]}, {selectedDateEfectiva.getDate()} de {MONTH_NAMES[selectedDateEfectiva.getMonth()]}</span>
                    : <span>Horarios disponibles</span>}
                </div>
                {selectedDateEfectiva && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${estadoFechaEstilo.chip}`}>
                    <span className={`size-1.5 rounded-full ${estadoFechaEstilo.punto}`} />
                    {estadoFechaEtiqueta}
                  </span>
                )}
              </div>

              {/* Los horarios se estiran a lo alto del calendario: sin hueco entre ellos y la duración */}
              <div className="flex min-h-0 flex-1 flex-col gap-1.5">
                {!selectedDateEfectiva ? (
                  <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
                    <CalendarIcon className="size-5" />
                    Elige un día en el calendario para ver sus horarios.
                  </div>
                ) : (
                  <>
                    {!dayAppointmentsLoading && horasLibres > 0 && (
                      <span className="text-xs font-medium text-muted-foreground block">
                        Selecciona una franja horaria disponible:
                      </span>
                    )}
                    {availableHours.length > 0 && (
                      <div className={`grid grid-cols-2 gap-2 @sm:grid-cols-3 @lg:grid-cols-4 @xl:grid-cols-5 ${availableHours.length > 4 ? "flex-1 auto-rows-fr" : "content-start"}`}>
                        {availableHours.map((hourStr) => {
                          const slot = slotAvailability[hourStr]
                          const isSelected = selectedHourEfectivo === hourStr
                          const isAvailable = slot?.available ?? true

                          return (
                            <button
                              key={hourStr}
                              type="button"
                              disabled={!isAvailable || dayAppointmentsLoading}
                              onClick={() => setSelectedHour(hourStr)}
                              className={`min-h-16 p-2.5 rounded-xl border text-xs font-medium transition-all text-center flex flex-col items-center justify-center gap-1 ${
                                isSelected
                                  ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                                  : isAvailable
                                  ? "bg-card hover:bg-muted/40 text-foreground border-border/70 hover:border-primary/40"
                                  : "bg-muted/40 text-muted-foreground/50 border-border/40 cursor-not-allowed line-through"
                              }`}
                              title={!isAvailable ? `Ocupado por ${slot?.conflictWith}` : "Disponible"}
                            >
                              <span className="text-sm font-bold">{hourStr}</span>
                              <span
                                className={`text-[10px] flex items-center gap-1 ${
                                  isSelected
                                    ? "text-primary-foreground"
                                    : isAvailable
                                    ? "text-primary"
                                    : "text-muted-foreground/60"
                                }`}
                              >
                                <span
                                  className={`size-1.5 rounded-full ${
                                    isSelected ? "bg-primary-foreground" : isAvailable ? "bg-primary" : "bg-destructive/60"
                                  }`}
                                />
                                {isAvailable ? "Disponible" : "Ocupado"}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {horasLibres === 0 && !dayAppointmentsLoading && (
                      <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs text-muted-foreground space-y-2">
                        <p>
                          {estadoDeFecha === "sin-horario"
                            ? `El profesional no atiende el ${formatearDiaCorto(selectedDateEfectiva)}.`
                            : `Sin horarios disponibles para el ${formatearDiaCorto(selectedDateEfectiva)}.`}
                        </p>
                        {nextAvailableDate && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedDate(nextAvailableDate)
                              setSelectedHour("")
                            }}
                            className="h-8 px-2.5 text-xs rounded-lg border-border/80 hover:border-primary/50"
                          >
                            Ir al {formatearDiaCorto(nextAvailableDate)}
                          </Button>
                        )}
                      </div>
                    )}
                    {dayAppointmentsLoading && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" />
                        <span>Consultando disponibilidad...</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Duración de la sesión */}
              <div className="space-y-1.5 pt-3 border-t border-border/50">
                <span className="text-xs font-medium text-muted-foreground block">
                  Duración de la sesión:
                </span>
                {isMinorPatient ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary text-xs font-semibold text-primary">
                    <Clock className="size-3.5" />
                    30 minutos (menor de edad)
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {DURATION_OPTIONS.map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDurationMinutes(mins)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          durationMinutes === mins
                            ? "bg-primary/10 border-primary text-primary font-semibold"
                            : "bg-card border-border/70 text-foreground hover:bg-muted/50"
                        }`}
                      >
                        {mins} minutos {mins === 50 && "(Estándar)"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: MODALIDAD Y MOTIVO DE CONSULTA */}
        <Card className="border-border/70 shadow-2xs bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <span>{isPatient ? "2." : "3."} Modalidad y Motivo de Consulta</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Define el formato de atención y el objetivo de la cita.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Modalidad Selection */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground block">
                Modalidad de la sesión:
              </span>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setModality(AppointmentModality.IN_PERSON)}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    modality === AppointmentModality.IN_PERSON
                      ? "border-primary bg-primary/[0.03] ring-1 ring-primary/30"
                      : "border-border/70 bg-card hover:bg-muted/30"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${modality === AppointmentModality.IN_PERSON ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <MapPin className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground font-heading">
                      Consulta Presencial
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Consultorio principal en clínica física.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setModality(AppointmentModality.VIRTUAL)}
                  className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                    modality === AppointmentModality.VIRTUAL
                      ? "border-primary bg-primary/[0.03] ring-1 ring-primary/30"
                      : "border-border/70 bg-card hover:bg-muted/30"
                  }`}
                >
                  <div className={`p-2 rounded-lg ${modality === AppointmentModality.VIRTUAL ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Video className="size-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground font-heading">
                      Consulta Virtual
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Videollamada encriptada en la plataforma.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Motivo de Consulta (Opcional) */}
            <div className="space-y-1.5">
              <label htmlFor="appointment-reason-textarea" className="text-xs font-medium text-muted-foreground block">
                Motivo de la consulta (Opcional)
              </label>
              <Textarea
                id="appointment-reason-textarea"
                placeholder="Ej. Sesión de seguimiento para manejo de ansiedad y técnicas cognitivas..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[90px] rounded-xl border-border/80 focus-visible:ring-primary/20 text-sm"
              />
              <span className="text-[11px] text-muted-foreground block">
                Este motivo se reflejará en el calendario y en el expediente clínico del paciente.
              </span>
            </div>
          </CardContent>
        </Card>

        {/* CARD 5: SECCIÓN DE ESTADO (Solo visible si la cita ya existe y es psicólogo) */}
        {isEdit && !isPatient && (
          <Card className="border-border/70 shadow-2xs bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                <span>5. Estado de la Cita</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Actualiza el estado administrativo de la consulta según su progreso.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setStatus(AppointmentStatus.PENDING)}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    status === AppointmentStatus.PENDING
                      ? "bg-amber-600 text-white border-amber-600 shadow-2xs"
                      : "bg-card border-border/70 text-foreground hover:bg-muted/40"
                  }`}
                >
                  <AlertCircle className="size-3.5" />
                  <span>Pendiente</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus(AppointmentStatus.CONFIRMED)}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    status === AppointmentStatus.CONFIRMED
                      ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                      : "bg-card border-border/70 text-foreground hover:bg-muted/40"
                  }`}
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>Confirmada</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus(AppointmentStatus.COMPLETED)}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    status === AppointmentStatus.COMPLETED
                      ? "bg-slate-700 text-white border-slate-700 shadow-2xs"
                      : "bg-card border-border/70 text-foreground hover:bg-muted/40"
                  }`}
                >
                  <Check className="size-3.5" />
                  <span>Completada</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(true)}
                  className={`p-2.5 rounded-xl border text-xs font-medium transition-all flex items-center justify-center gap-1.5 ${
                    status === AppointmentStatus.CANCELLED
                      ? "bg-rose-600 text-white border-rose-600 shadow-2xs"
                      : "bg-card border-border/70 text-rose-600 hover:bg-rose-50/50"
                  }`}
                >
                  <XCircle className="size-3.5" />
                  <span>Cancelada</span>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CARD: COSTO DE LA SESIÓN (calculado en vivo) */}
        {previewPrice !== null && (
          <Card className="border-primary/30 bg-primary/[0.03] shadow-2xs">
            <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <DollarSign className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground font-heading">
                    Costo de la sesión
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isMinorPatient ? "Tarifa menor de edad (30 min)" : "Tarifa adulto"}
                    {selectedDateEfectiva && isSameDay(selectedDateEfectiva, ahora) && " · Incluye recargo por mismo día"}
                    {modality === AppointmentModality.VIRTUAL && " · Descuento por sesión virtual"}
                  </p>
                </div>
              </div>
              <div className="text-2xl font-bold text-primary font-heading sm:text-right">
                ${previewPrice.toLocaleString("es-MX")}
              </div>
            </CardContent>
          </Card>
        )}

        {/* FOOTER DE BOTONES DE ACCIÓN */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-border/60">
          {/* Botones secundarios en modo edición */}
          {isEdit ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setIsCancelModalOpen(true)}
                disabled={isSubmitting || status === AppointmentStatus.CANCELLED}
                className="h-10 px-3.5 rounded-xl text-xs font-medium gap-1.5"
              >
                <XCircle className="size-4" />
                <span>Cancelar Cita</span>
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/agenda")}
              className="h-10 px-4 rounded-xl text-xs border-border/80"
            >
              Descartar
            </Button>
          )}

          {/* Botón Principal */}
          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/agenda")}
              className="h-10 px-4 rounded-xl text-xs border-border/80 hidden sm:inline-flex"
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              disabled={!formularioCompleto || isSubmitting}
              className={`h-10 px-6 rounded-xl shadow-sm font-semibold text-sm gap-2 ${
                formularioCompleto
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isEdit ? (
                <Save className="size-4" />
              ) : (
                <Plus className="size-4 stroke-[2.5]" />
              )}
              <span>
                {isSubmitting
                  ? "Guardando..."
                  : isEdit
                    ? isPatient
                      ? "Solicitar cambio"
                      : "Guardar cambios"
                    : isPatient
                      ? "Solicitar Cita"
                      : "Guardar Cita"}
              </span>
            </Button>
          </div>
        </div>
      </form>

      {/* MODAL DE CANCELACIÓN (PIDE MOTIVO OBLIGATORIO) */}
      <Dialog open={isCancelModalOpen} onOpenChange={setIsCancelModalOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-card border-border/80">
          <DialogHeader className="space-y-1.5">
            <div className="size-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-1">
              <XCircle className="size-5" />
            </div>
            <DialogTitle className="text-lg font-heading font-semibold text-foreground">
              Cancelar Cita
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Para cancelar esta sesión clínica, ingresa obligatoriamente el motivo para el registro histórico del paciente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label htmlFor="cancel-reason-textarea" className="text-xs font-semibold text-foreground block">
                Motivo de cancelación <span className="text-rose-600">*</span>
              </label>
              <Textarea
                id="cancel-reason-textarea"
                placeholder="Ej. Paciente notificó incompatibilidad laboral con 24h de anticipación..."
                value={cancellationReason}
                onChange={(e) => {
                  setCancellationReason(e.target.value)
                  if (cancelError) setCancelError("")
                }}
                className="min-h-[85px] rounded-xl text-xs"
              />
              {cancelError && (
                <p className="text-[11px] text-rose-600 font-medium">{cancelError}</p>
              )}
            </div>

            {initialAppointment && (
              <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-xs border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900">
                Esta acción liberará la franja del {formatearDiaHora(toDate(initialAppointment.startTime))} en la agenda digital.
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCancelModalOpen(false)}
              className="h-9 rounded-xl border-border/80 text-xs"
            >
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={isSubmitting}
              className="h-9 rounded-xl text-xs font-semibold"
            >
              {isSubmitting ? "Cancelando..." : "Confirmar Cancelación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE REAGENDAMIENTO (PACIENTE) */}
      <Dialog
        open={isRescheduleModalOpen}
        onOpenChange={(open) => {
          setIsRescheduleModalOpen(open)
          if (!open) setRescheduleDraft(null)
        }}
      >
        <DialogContent className="sm:max-w-md p-6 bg-card border-border/80">
          <DialogHeader className="space-y-1.5">
            <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1">
              <RefreshCw className="size-5" />
            </div>
            <DialogTitle className="text-lg font-heading font-semibold text-foreground">
              Reagendar cita
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {initialAppointment && rescheduleDraft
                ? `Tu cita actual es el ${formatearDiaHora(toDate(initialAppointment.startTime))}. Al continuar, se cancelará y enviaremos una solicitud para el ${formatearDiaHora(rescheduleDraft.startTime)}. Tu psicólogo debe confirmarla.`
                : "Tu cita actual se cancelará y enviaremos una solicitud con el nuevo horario."}
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-xs border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900">
            La franja actual se liberará de inmediato. Si la solicitud no se acepta, podrás pedir otro horario.
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRescheduleModalOpen(false)}
              disabled={isSubmitting}
              className="h-9 rounded-xl border-border/80 text-xs"
            >
              Volver
            </Button>
            <Button
              type="button"
              onClick={handleConfirmReschedule}
              disabled={isSubmitting}
              className="h-9 rounded-xl text-xs font-semibold"
            >
              {isSubmitting ? "Enviando..." : "Solicitar cambio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function AppointmentForm(props: AppointmentFormProps) {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-64 items-center justify-center rounded-2xl border border-border/60 bg-card p-8 text-center text-sm text-muted-foreground">
          Cargando formulario de cita...
        </div>
      }
    >
      <AppointmentFormInner {...props} />
    </React.Suspense>
  )
}
