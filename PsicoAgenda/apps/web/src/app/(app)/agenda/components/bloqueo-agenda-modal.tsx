"use client"

import * as React from "react"
import { Loader2, TriangleAlert } from "lucide-react"
import {
  AppointmentStatus,
  type AgendaBlock,
  type Appointment,
  type PsychologistSchedule,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DateRangePicker, type DateRange } from "@/components/motion/date-range-picker"
import { useToast } from "@/components/toast-provider"
import { ApiError } from "@/lib/api-client"
import { tramosContiguos } from "@/lib/bloqueos"
import { cn } from "@/lib/utils"
import { agendaBlockService, appointmentService, psychologistService } from "@/services"

function toInputDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Fecha local a partir de `YYYY-MM-DD` (sin pasar por UTC). */
function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function withTime(date: Date, value: string): Date {
  const [hours, minutes] = value.split(":").map(Number)
  const result = new Date(date)
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  return result
}

const diaLargo = (date: Date) =>
  date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })

// Mismo respaldo que Solicitar cita cuando la psicóloga no ha definido horario.
const FRANJAS_RESPALDO = Array.from({ length: 10 }, (_, i) => ({
  startTime: `${String(9 + i).padStart(2, "0")}:00`,
  endTime: `${String(10 + i).padStart(2, "0")}:00`,
}))

const EJEMPLOS_MOTIVO = ["Vacaciones", "Día festivo", "Asunto personal"]

export interface BloqueoAgendaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Día que se propone al abrir el modal. */
  defaultDate?: Date
  onCreated?: (block: AgendaBlock) => void
  /** Nombre del paciente de una cita, para avisar a quién afecta el bloqueo. */
  patientName?: (patientId: string) => string | undefined
  /** Citas que se cancelaron al bloquear, para refrescar la agenda. */
  onAppointmentsCancelled?: (appointments: Appointment[]) => void
}

export function BloqueoAgendaModal({
  open,
  onOpenChange,
  defaultDate,
  onCreated,
  patientName,
  onAppointmentsCancelled,
}: BloqueoAgendaModalProps) {
  const { toast } = useToast()
  const [ahora] = React.useState(() => new Date())
  const hoy = toInputDate(ahora)
  const [range, setRange] = React.useState<DateRange | null>(() => {
    const propuesto = toInputDate(defaultDate ?? ahora)
    return { from: propuesto < hoy ? hoy : propuesto }
  })
  const [allDay, setAllDay] = React.useState(true)
  const [horas, setHoras] = React.useState<string[]>([])
  const [reason, setReason] = React.useState("")
  // Qué pasa con las citas que quedan dentro del bloqueo: se conservan salvo que se pida cancelarlas.
  const [cancelarCitas, setCancelarCitas] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [intento, setIntento] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const [schedule, setSchedule] = React.useState<PsychologistSchedule | null>(null)
  const [citas, setCitas] = React.useState<Appointment[]>([])
  const [bloqueos, setBloqueos] = React.useState<AgendaBlock[]>([])

  const desde = range ? parseDateInput(range.from) : null
  const hasta = range ? parseDateInput(range.to ?? range.from) : null
  const variosDias = !!range?.to && range.to !== range.from
  const diaCompleto = variosDias || allDay
  const desdeMs = desde?.getTime()
  const hastaMs = hasta?.getTime()

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    // Sin horario propio se usan las franjas de respaldo: el fallo no bloquea el formulario.
    psychologistService.getMySchedule().then(
      (value) => !cancelled && setSchedule(value),
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [open])

  // Citas y bloqueos del rango elegido: avisan qué se pisa antes de guardar.
  React.useEffect(() => {
    if (!open || desdeMs === undefined || hastaMs === undefined) return
    let cancelled = false
    const from = new Date(desdeMs)
    const to = new Date(hastaMs)
    to.setDate(to.getDate() + 1)
    Promise.all([appointmentService.list({ from, to }), agendaBlockService.list({ from, to })]).then(
      ([listaCitas, listaBloqueos]) => {
        if (cancelled) return
        setCitas(
          listaCitas.filter(
            (cita) => cita.status === AppointmentStatus.PENDING || cita.status === AppointmentStatus.CONFIRMED,
          ),
        )
        setBloqueos(listaBloqueos)
      },
      // Si no cargan, el servidor sigue rechazando los solapes al guardar.
      () => undefined,
    )
    return () => {
      cancelled = true
    }
  }, [open, desdeMs, hastaMs])

  // Franjas de atención del día elegido (solo aplica a un único día).
  const franjas = React.useMemo(() => {
    if (!desde) return []
    const jsDay = desde.getDay()
    const dbDay = jsDay === 0 ? 7 : jsDay
    if (!schedule || schedule.slots.length === 0) return dbDay <= 5 ? FRANJAS_RESPALDO : []
    return schedule.slots
      .filter((slot) => slot.dayOfWeek === dbDay)
      .map(({ startTime, endTime }) => ({ startTime: startTime.slice(0, 5), endTime: endTime.slice(0, 5) }))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `desde` se deriva de desdeMs
  }, [schedule, desdeMs])

  // Lo que se va a guardar: un bloqueo de días completos o uno por tramo de horas seguidas.
  const intervalos = React.useMemo(() => {
    if (!desde || !hasta) return []
    if (diaCompleto) {
      const end = new Date(hasta)
      end.setDate(end.getDate() + 1)
      return [{ start: desde, end }]
    }
    return tramosContiguos(franjas.filter((franja) => horas.includes(franja.startTime))).map((tramo) => ({
      start: withTime(desde, tramo.startTime),
      end: withTime(desde, tramo.endTime),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fechas derivadas de desdeMs/hastaMs
  }, [desdeMs, hastaMs, diaCompleto, franjas, horas])

  const finDeCita = (cita: Appointment) => new Date(cita.startTime.getTime() + cita.durationMinutes * 60_000)
  const citaEn = (start: Date, end: Date) => citas.find((cita) => cita.startTime < end && finDeCita(cita) > start)
  const afectadas = citas.filter((cita) =>
    intervalos.some(({ start, end }) => cita.startTime < end && finDeCita(cita) > start),
  )
  const nombres = Array.from(
    new Set(afectadas.map((cita) => patientName?.(cita.patientId)).filter((n): n is string => !!n)),
  )

  const resumen = !desde || !hasta
    ? "Elige un día en el calendario."
    : variosDias
      ? `Del ${diaLargo(desde)} al ${diaLargo(hasta)}, todo el día`
      : diaCompleto
        ? `${diaLargo(desde)}, todo el día`
        : intervalos.length > 0
          ? `${diaLargo(desde)}, ${intervalos
              .map(({ start, end }) => `${toHora(start)} a ${toHora(end)}`)
              .join(" y ")}`
          : `${diaLargo(desde)}: toca los horarios que quieres bloquear`

  const errorHoras = intento && !diaCompleto && intervalos.length === 0 ? "Elige al menos un horario." : null
  const errorFecha = intento && !range ? "Elige el día que quieres bloquear." : null

  const alternarHora = (hora: string) =>
    setHoras((prev) => (prev.includes(hora) ? prev.filter((h) => h !== hora) : [...prev, hora]))

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIntento(true)
    setError(null)
    if (intervalos.length === 0) return

    setIsSaving(true)
    let guardados = 0
    try {
      for (const { start, end } of intervalos) {
        const block = await agendaBlockService.create({
          startTime: start,
          endTime: end,
          allDay: diaCompleto,
          reason: reason.trim() || undefined,
        })
        guardados += 1
        onCreated?.(block)
      }
      // Cancelar avisa a cada paciente (campana, correo, WhatsApp) con el botón "Solicitar otra cita".
      if (cancelarCitas && afectadas.length > 0) {
        const resultados = await Promise.allSettled(
          afectadas.map((cita) =>
            appointmentService.cancel(cita.id, "La psicóloga no podrá atender en ese horario. Solicita otra cita cuando gustes."),
          ),
        )
        const canceladas = resultados.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
        onAppointmentsCancelled?.(canceladas)
        if (canceladas.length < afectadas.length) {
          setCitas((prev) => prev.filter((cita) => !canceladas.some((c) => c.id === cita.id)))
          setError("La agenda quedó bloqueada, pero no se pudieron cancelar todas las citas. Cancélalas desde la agenda.")
          return
        }
        toast({
          title: canceladas.length === 1 ? "Agenda bloqueada y 1 cita cancelada" : `Agenda bloqueada y ${canceladas.length} citas canceladas`,
          description: "Se avisó a los pacientes para que pidan otro horario.",
          status: "success",
        })
      } else {
        toast({ title: "Agenda bloqueada", status: "success" })
      }
      onOpenChange(false)
    } catch (err) {
      const mensaje =
        err instanceof ApiError && err.status === 409
          ? "Ya tienes un bloqueo en ese horario. Revisa «Bloqueos» o elige otro."
          : err instanceof Error
            ? err.message
            : "No se pudo bloquear la agenda."
      setError(guardados > 0 ? `Se guardó una parte. ${mensaje}` : mensaje)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="max-h-[92dvh] overflow-x-hidden overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">Bloquear agenda</DialogTitle>
          <DialogDescription>
            Nadie podrá pedir cita en ese tiempo. Si ya hay citas, tú decides si se conservan o se cancelan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">¿Qué días?</p>
            <DateRangePicker
              value={range}
              onValueChange={(next) => {
                setRange(next)
                setHoras([])
                setError(null)
              }}
              defaultMonth={range?.from ?? hoy}
              min={hoy}
              locale="es-MX"
              label="Días a bloquear"
              showSummary={false}
              disabled={isSaving}
              className="mx-auto"
            />
            <p className="text-xs text-muted-foreground">
              Toca un día, o el primero y el último para bloquear varios seguidos.
            </p>
            {errorFecha && (
              <p role="alert" className="text-sm text-destructive">
                {errorFecha}
              </p>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <p
              aria-live="polite"
              className="rounded-[14px] bg-primary/[0.06] px-4 py-3 text-sm font-medium text-foreground first-letter:uppercase"
            >
              {resumen}
            </p>

            {variosDias ? (
              <p className="text-sm text-muted-foreground">Al elegir varios días se bloquean completos.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="bloqueo-todo-el-dia" className="text-sm font-medium">
                    Todo el día
                  </Label>
                  <Switch
                    id="bloqueo-todo-el-dia"
                    checked={allDay}
                    onCheckedChange={setAllDay}
                    disabled={isSaving || !range}
                  />
                </div>

                {!allDay && range && desde && (
                  <fieldset aria-describedby={errorHoras ? "bloqueo-error-horas" : undefined}>
                    <legend className="mb-2 text-sm text-muted-foreground">Horarios a bloquear</legend>
                    {franjas.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Ese día no tienes horario de atención. Puedes bloquearlo completo.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {franjas.map((franja) => {
                          const start = withTime(desde, franja.startTime)
                          const end = withTime(desde, franja.endTime)
                          const yaBloqueado = bloqueos.some((b) => b.startTime < end && b.endTime > start)
                          const cita = citaEn(start, end)
                          const elegido = horas.includes(franja.startTime)
                          const nota = yaBloqueado
                            ? "Ya bloqueado"
                            : cita
                              ? (patientName?.(cita.patientId) ?? "Con cita")
                              : null
                          return (
                            <button
                              key={franja.startTime}
                              type="button"
                              aria-pressed={elegido}
                              disabled={isSaving || yaBloqueado || start < ahora}
                              onClick={() => alternarHora(franja.startTime)}
                              className={cn(
                                "flex min-h-11 flex-col items-center justify-center rounded-[14px] border px-2 py-1.5 text-sm font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45",
                                elegido
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-card text-foreground hover:bg-muted",
                              )}
                            >
                              {franja.startTime}
                              {nota && (
                                <span
                                  className={cn(
                                    "max-w-full truncate text-xs font-normal",
                                    elegido ? "text-primary-foreground/85" : "text-muted-foreground",
                                  )}
                                >
                                  {nota}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {errorHoras && (
                      <p id="bloqueo-error-horas" role="alert" className="mt-2 text-sm text-destructive">
                        {errorHoras}
                      </p>
                    )}
                  </fieldset>
                )}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="bloqueo-motivo" className="text-sm font-medium">
                  Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
                </Label>
                <span className="text-xs tabular-nums text-muted-foreground">{reason.length}/100</span>
              </div>
              <Input
                id="bloqueo-motivo"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={100}
                placeholder="Solo lo ves tú"
                disabled={isSaving}
              />
              <div className="flex flex-wrap gap-2">
                {EJEMPLOS_MOTIVO.map((ejemplo) => (
                  <button
                    key={ejemplo}
                    type="button"
                    disabled={isSaving}
                    onClick={() => setReason(ejemplo)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {ejemplo}
                  </button>
                ))}
              </div>
            </div>

            {afectadas.length > 0 && (
              <div
                role="status"
                className="flex gap-3 rounded-[14px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div className="space-y-3">
                <p>
                  <span className="font-medium">
                    {afectadas.length === 1
                      ? "Hay 1 cita en ese tiempo"
                      : `Hay ${afectadas.length} citas en ese tiempo`}
                  </span>
                  {nombres.length > 0 && `: ${nombres.join(", ")}`}.{" "}
                  {cancelarCitas
                    ? "Se cancelarán y cada paciente recibirá un aviso para pedir otro horario."
                    : "Si no las cancelas, siguen en pie aunque el horario quede bloqueado."}
                </p>
                <label className="flex cursor-pointer items-start gap-2.5 font-medium">
                  <Checkbox
                    checked={cancelarCitas}
                    onCheckedChange={(value) => setCancelarCitas(value === true)}
                    disabled={isSaving}
                    className="mt-0.5"
                  />
                  Cancelarlas y avisar a los pacientes para que pidan otro horario
                </label>
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <DialogFooter className="mt-auto gap-2 sm:gap-2">
              <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} aria-busy={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="animate-spin" aria-hidden="true" />
                    Bloqueando…
                  </>
                ) : afectadas.length > 0 && cancelarCitas ? (
                  afectadas.length === 1 ? "Bloquear y cancelar 1 cita" : `Bloquear y cancelar ${afectadas.length} citas`
                ) : afectadas.length > 0 ? (
                  "Bloquear y conservar citas"
                ) : (
                  "Bloquear"
                )}
              </Button>
            </DialogFooter>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function toHora(date: Date): string {
  return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false })
}
