"use client"

import * as React from "react"
import { CalendarOff, Loader2, Lock, X } from "lucide-react"
import type { AgendaBlock } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { agendaBlockService } from "@/services"

function toInputDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Construye una fecha local a partir de `YYYY-MM-DD` (sin pasar por UTC). */
function parseDateInput(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function withTime(date: Date, value: string): Date {
  const [hours, minutes] = value.split(":").map(Number)
  const result = new Date(date)
  result.setHours(hours ?? 0, minutes ?? 0, 0, 0)
  return result
}

/**
 * Estilo literal del modal de referencia. Se usan inputs HTML planos (no
 * `Input`) para que los `focus-visible` del tema no ganen la especificidad y el
 * teal sea exactamente `#00c896`.
 */
const fieldClass =
  "h-11 w-full rounded-lg border border-gray-800 bg-[#242424] px-3.5 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-[#00c896] focus:ring-2 focus:ring-[#00c896]/30 [color-scheme:dark]"

export interface BloqueoAgendaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Día que se propone al abrir el modal. */
  defaultDate?: Date
  onCreated?: (block: AgendaBlock) => void
}

export function BloqueoAgendaModal({
  open,
  onOpenChange,
  defaultDate,
  onCreated,
}: BloqueoAgendaModalProps) {
  const [date, setDate] = React.useState(() => toInputDate(defaultDate ?? new Date()))
  const [allDay, setAllDay] = React.useState(true)
  const [startTime, setStartTime] = React.useState("09:00")
  const [endTime, setEndTime] = React.useState("10:00")
  const [reason, setReason] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const baseDate = parseDateInput(date)
    if (!baseDate) {
      setError("Elige una fecha válida")
      return
    }

    let startTimeValue: Date
    let endTimeValue: Date

    if (allDay) {
      // El día completo viaja como instantes: 00:00 local a 00:00 del día siguiente.
      startTimeValue = new Date(baseDate)
      startTimeValue.setHours(0, 0, 0, 0)
      endTimeValue = new Date(startTimeValue)
      endTimeValue.setDate(endTimeValue.getDate() + 1)
    } else {
      startTimeValue = withTime(baseDate, startTime)
      endTimeValue = withTime(baseDate, endTime)

      if (endTimeValue.getTime() <= startTimeValue.getTime()) {
        setError("La hora de fin debe ser posterior a la de inicio")
        return
      }
    }

    setIsSaving(true)
    try {
      const created = await agendaBlockService.create({
        startTime: startTimeValue,
        endTime: endTimeValue,
        allDay,
        reason: reason.trim() || undefined,
      })
      onCreated?.(created)
      onOpenChange(false)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        className="sm:max-w-md gap-0 rounded-2xl border border-gray-800 bg-[#1c1c1c] p-6 text-gray-100 shadow-2xl [color-scheme:dark]"
      >
        <DialogClose
          aria-label="Cerrar"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-gray-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c896]/40"
        >
          <X className="size-5" />
        </DialogClose>

        <div className="mb-6 flex items-start gap-3 pr-8">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#00c896]/10 text-[#00c896]">
            <CalendarOff className="size-5" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-lg font-semibold text-white">
              Bloquear agenda
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-relaxed text-gray-400">
              Marca un día completo o un rango de horas como no disponible para tus
              pacientes.
            </DialogDescription>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="bloqueo-fecha"
              className="block text-sm font-medium text-white"
            >
              Fecha
            </label>
            <input
              id="bloqueo-fecha"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={fieldClass}
              required
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-800 bg-[#242424] p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">Todo el día</p>
              <p className="mt-0.5 text-xs text-gray-400">
                El día completo quedará no disponible.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={allDay}
              aria-label="Bloquear todo el día"
              onClick={() => setAllDay((value) => !value)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c896]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1c] ${
                allDay ? "bg-[#00c896]" : "bg-gray-600"
              }`}
            >
              <span
                className={`pointer-events-none block size-[18px] rounded-full shadow-sm transition-transform duration-200 ${
                  allDay
                    ? "translate-x-[22px] bg-[#111111]"
                    : "translate-x-[3px] bg-gray-200"
                }`}
              />
            </button>
          </div>

          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="bloqueo-desde"
                  className="block text-sm font-medium text-white"
                >
                  De
                </label>
                <input
                  id="bloqueo-desde"
                  type="time"
                  value={startTime}
                  onChange={(event) => setStartTime(event.target.value)}
                  className={fieldClass}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="bloqueo-hasta"
                  className="block text-sm font-medium text-white"
                >
                  Hasta
                </label>
                <input
                  id="bloqueo-hasta"
                  type="time"
                  value={endTime}
                  onChange={(event) => setEndTime(event.target.value)}
                  className={fieldClass}
                  required
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="bloqueo-motivo"
              className="block text-sm font-medium text-white"
            >
              Motivo{" "}
              <span className="text-xs font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              id="bloqueo-motivo"
              type="text"
              value={reason}
              maxLength={100}
              placeholder="Congreso, vacaciones, trámite..."
              onChange={(event) => setReason(event.target.value)}
              className={fieldClass}
            />
            <p className="text-right text-xs text-gray-500">{reason.length}/100</p>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-600 disabled:pointer-events-none disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#00c896] px-4 py-2.5 text-sm font-semibold text-[#06231f] transition hover:bg-[#00b386] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00c896]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export interface GestionBloqueosDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  blocks: AgendaBlock[]
  onDeleted?: (id: string) => void
}

/**
 * Lista los bloqueos del rango visible y permite borrarlos. Las tarjetas del
 * calendario se quedan inactivas (sin botones); la gestión vive aquí.
 */
export function GestionBloqueosDialog({
  open,
  onOpenChange,
  blocks,
  onDeleted,
}: GestionBloqueosDialogProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  // Al cerrar se limpia la confirmación pendiente y el error; hacerlo aquí evita
  // reiniciar el estado desde un efecto.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setConfirmingId(null)
      setDeletingId(null)
      setError(null)
    }
    onOpenChange(next)
  }

  const sorted = React.useMemo(
    () => [...blocks].sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
    [blocks],
  )

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setError(null)
    try {
      await agendaBlockService.remove(id)
      onDeleted?.(id)
      setConfirmingId(null)
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el bloqueo",
      )
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border/80">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-heading">
            <Lock className="size-5 text-primary" />
            Bloqueos de este periodo
          </DialogTitle>
          <DialogDescription>
            Estos rangos no están disponibles para agendar. Puedes eliminarlos si
            ya no aplican.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {sorted.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No hay bloqueos en el periodo visible.
            </p>
          ) : (
            sorted.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-gray-800 bg-[#242424] p-3 opacity-90"
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-medium text-gray-300">
                    {block.allDay
                      ? "Todo el día"
                      : `${block.startTime.toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })} – ${block.endTime.toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {block.startTime.toLocaleDateString("es-MX", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {" · "}
                    {block.reason ?? "No disponible"}
                  </p>
                </div>

                {confirmingId === block.id ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => void handleDelete(block.id)}
                      disabled={deletingId === block.id}
                    >
                      {deletingId === block.id && (
                        <Loader2 className="size-3.5 animate-spin" />
                      )}
                      Eliminar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingId(null)}
                      disabled={deletingId === block.id}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingId(block.id)}
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    Quitar
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {error && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
