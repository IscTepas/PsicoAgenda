"use client"

import * as React from "react"
import { CalendarDays, ChevronDown } from "lucide-react"
import { WheelPicker } from "@/components/motion/wheel-picker"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

const pad = (n: number) => String(n).padStart(2, "0")
const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate()

/** "YYYY-MM-DD" → partes numéricas; null si viene vacío o mal formado. */
function parse(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) }
}

/**
 * Fecha con tres ruedas (día, mes, año): fecha de nacimiento en el registro y
 * período de Reportes. El valor es el string "YYYY-MM-DD"; solo se escribe al
 * pulsar "Listo", así un campo obligatorio nunca queda con una fecha no elegida.
 */
export function WheelDatePicker({
  value,
  onChange,
  defaultYear,
  fromYear,
  toYear,
  placeholder = "Elige una fecha",
  className,
  invalid,
  id,
  "aria-describedby": describedBy,
}: {
  value: string
  onChange: (value: string) => void
  /** Año en el que abre la rueda cuando aún no hay fecha. */
  defaultYear: number
  /** Rango de años de la rueda (inclusive); se listan del más reciente al más antiguo. */
  fromYear: number
  toYear: number
  placeholder?: string
  /** Clases extra del disparador (p. ej. alto y tamaño de texto). */
  className?: string
  invalid?: boolean
  /** id y aria-describedby llegan de FormControl: enlazan la etiqueta y el mensaje de error. */
  id?: string
  "aria-describedby"?: string
}) {
  const [open, setOpen] = React.useState(false)
  const parsed = parse(value)

  // Borrador mientras el panel está abierto; arranca en la fecha guardada o en el año sugerido.
  const [draft, setDraft] = React.useState({ day: 1, month: 0, year: defaultYear })
  const openPicker = (next: boolean) => {
    if (next) setDraft(parsed ?? { day: 1, month: 0, year: defaultYear })
    setOpen(next)
  }

  const years = React.useMemo(
    () => Array.from({ length: toYear - fromYear + 1 }, (_, i) => String(toYear - i)),
    [fromYear, toYear],
  )
  const days = React.useMemo(
    () => Array.from({ length: daysIn(draft.year, draft.month) }, (_, i) => String(i + 1)),
    [draft.year, draft.month],
  )
  const months = React.useMemo(() => MONTHS.map((label, i) => ({ label, value: String(i) })), [])

  // Al cambiar mes o año, el día se ajusta al último del mes (31 de enero → 28 de febrero).
  const update = (patch: Partial<typeof draft>) =>
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      return { ...next, day: Math.min(next.day, daysIn(next.year, next.month)) }
    })

  const confirm = () => {
    onChange(`${draft.year}-${pad(draft.month + 1)}-${pad(draft.day)}`)
    setOpen(false)
  }

  const label = parsed ? `${parsed.day} de ${MONTHS[parsed.month]} de ${parsed.year}` : null

  return (
    <Popover open={open} onOpenChange={openPicker}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-describedby={describedBy}
          aria-haspopup="dialog"
          data-invalid={invalid || undefined}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-xl border border-input bg-card px-3.5 text-left text-sm transition-colors outline-none",
            "hover:border-primary/40 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20",
            "data-invalid:border-destructive data-invalid:ring-3 data-invalid:ring-destructive/20 data-[state=open]:border-primary",
            className,
          )}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className={cn("flex-1 truncate", !label && "text-muted-foreground")}>
            {label ?? placeholder}
          </span>
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 [[data-state=open]_&]:rotate-180"
            aria-hidden="true"
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] p-3">
        <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_4.5rem] gap-1">
          <WheelPicker
            aria-label="Día"
            options={days}
            value={String(draft.day)}
            onValueChange={(v) => update({ day: Number(v) })}
          />
          <WheelPicker
            aria-label="Mes"
            options={months}
            value={String(draft.month)}
            onValueChange={(v) => update({ month: Number(v) })}
          />
          <WheelPicker
            aria-label="Año"
            options={years}
            value={String(draft.year)}
            onValueChange={(v) => update({ year: Number(v) })}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <span className="text-xs text-muted-foreground">
            {draft.day} de {MONTHS[draft.month]} de {draft.year}
          </span>
          <Button type="button" size="sm" onClick={confirm} className="rounded-lg">
            Listo
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
