"use client"

import * as React from "react"
import { Clock, Loader2 } from "lucide-react"
import { Calendar } from "@/components/arc/calendar/calendar"
import { cn } from "@/lib/utils"

export interface BloquearAgendaPayload {
  startTime: Date
  endTime: Date
  allDay: boolean
  reason?: string
}

export interface BloquearAgendaPanelProps {
  /** Se llama al confirmar con los instantes ya calculados. */
  onConfirm?: (payload: BloquearAgendaPayload) => void | Promise<void>
  onCancel?: () => void
  className?: string
}

/** Inputs/time pickers con el aspecto oscuro del panel. */
const inputClass =
  "h-10 w-full rounded-lg border border-gray-800 bg-[#242424] px-3 text-sm text-gray-100 outline-none transition-colors placeholder:text-gray-500 focus:border-[#00c896] focus:ring-2 focus:ring-[#00c896]/20 [color-scheme:dark]"

function formatFecha(date?: Date): string {
  if (!date) return "Selecciona una fecha en el calendario"
  const label = date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Panel de alta de un bloqueo de agenda con la misma estructura de dos columnas
 * que el formulario de cita: calendario a la izquierda y opciones a la derecha.
 *
 * El componente es presentacional: calcula los instantes (incluido el día
 * completo, de 00:00 local a 00:00 del día siguiente) y los entrega por
 * `onConfirm`; la persistencia queda en quien lo use.
 */
export function BloquearAgendaPanel({
  onConfirm,
  onCancel,
  className,
}: BloquearAgendaPanelProps) {
  const [fechaSeleccionada, setFechaSeleccionada] = React.useState<Date | undefined>()
  const [mesVisible, setMesVisible] = React.useState<Date>(() => new Date())
  const [todoElDia, setTodoElDia] = React.useState(true)
  const [horaInicio, setHoraInicio] = React.useState("09:00")
  const [horaFin, setHoraFin] = React.useState("10:00")
  const [motivo, setMotivo] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const faltanHoras = !todoElDia && (!horaInicio || !horaFin)
  const rangoInvalido =
    !todoElDia && Boolean(horaInicio && horaFin) && horaFin <= horaInicio
  const puedeConfirmar =
    Boolean(fechaSeleccionada) && !faltanHoras && !rangoInvalido && !isSaving

  const handleConfirmar = async () => {
    if (!fechaSeleccionada || !puedeConfirmar) return

    const startTime = new Date(fechaSeleccionada)
    let endTime: Date

    if (todoElDia) {
      // El día completo viaja como instantes: 00:00 local a 00:00 del día siguiente.
      startTime.setHours(0, 0, 0, 0)
      endTime = new Date(startTime)
      endTime.setDate(endTime.getDate() + 1)
    } else {
      const [hInicio, mInicio] = horaInicio.split(":").map(Number)
      const [hFin, mFin] = horaFin.split(":").map(Number)
      startTime.setHours(hInicio, mInicio, 0, 0)
      endTime = new Date(fechaSeleccionada)
      endTime.setHours(hFin, mFin, 0, 0)
    }

    setError(null)
    setIsSaving(true)
    try {
      await onConfirm?.({
        startTime,
        endTime,
        allDay: todoElDia,
        reason: motivo.trim() || undefined,
      })
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo guardar el bloqueo",
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-2xl border border-gray-800 bg-[#141414] text-gray-100 shadow-2xl [color-scheme:dark]",
        className,
      )}
    >
      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-0 md:p-0">
        {/* Columna izquierda: calendario */}
        <div className="md:p-6 md:pr-6">
          <Calendar
            className="mx-auto md:mx-0"
            value={fechaSeleccionada}
            month={mesVisible}
            onMonthChange={setMesVisible}
            onChange={(fecha) => setFechaSeleccionada(fecha)}
            showToday
          />
        </div>

        {/* Columna derecha: detalles y acciones */}
        <div className="flex min-w-0 flex-col gap-5 border-t border-gray-800 pt-6 md:border-t-0 md:border-l md:p-6 md:pt-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Clock className="size-4 text-[#00c896]" />
              <span>Detalles del bloqueo</span>
            </div>
            <p className="text-xs text-gray-400">{formatFecha(fechaSeleccionada)}</p>
          </div>

          <div className="space-y-4">
            {/* Toggle día completo */}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-[#1a1a1a] p-3.5">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-gray-100">Bloquear todo el día</p>
                <p className="text-xs text-gray-400">
                  {todoElDia
                    ? "El día completo quedará no disponible."
                    : "Indica las horas que no vas a atender."}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={todoElDia}
                aria-label="Bloquear todo el día"
                onClick={() => setTodoElDia((value) => !value)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#00c896]/40",
                  todoElDia
                    ? "border-[#00c896] bg-[#00c896]"
                    : "border-gray-700 bg-[#242424]",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none block size-[18px] rounded-full bg-white shadow-sm transition-transform duration-200",
                    todoElDia ? "translate-x-[22px]" : "translate-x-[2px]",
                  )}
                />
              </button>
            </div>

            {/* Horas específicas */}
            {!todoElDia && (
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="block text-xs font-medium text-gray-400">
                    De (Hora inicio)
                  </span>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(event) => setHoraInicio(event.target.value)}
                    className={inputClass}
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="block text-xs font-medium text-gray-400">
                    Hasta (Hora fin)
                  </span>
                  <input
                    type="time"
                    value={horaFin}
                    onChange={(event) => setHoraFin(event.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
            )}

            {rangoInvalido && (
              <p role="alert" className="text-xs font-medium text-red-400">
                La hora de fin debe ser posterior a la de inicio.
              </p>
            )}

            {/* Motivo */}
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-gray-400">
                Motivo (opcional)
              </span>
              <input
                type="text"
                value={motivo}
                maxLength={100}
                placeholder="Congreso, vacaciones, trámite…"
                onChange={(event) => setMotivo(event.target.value)}
                className={inputClass}
              />
              <span className="block text-right text-[11px] text-gray-500">
                {motivo.length}/100
              </span>
            </label>
          </div>

          {/* Acciones */}
          <div className="mt-auto border-t border-gray-800 pt-4">
            {error && (
              <p role="alert" className="mb-3 text-xs font-medium text-red-400">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmar()}
                disabled={!puedeConfirmar}
                className="inline-flex items-center gap-2 rounded-lg bg-[#00c896] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#00b386] disabled:pointer-events-none disabled:opacity-50"
              >
                {isSaving && <Loader2 className="size-4 animate-spin" />}
                Confirmar Bloqueo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
