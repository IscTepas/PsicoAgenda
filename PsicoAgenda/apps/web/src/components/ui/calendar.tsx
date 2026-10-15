"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"]

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Cuadrícula del mes empezando en lunes, completada con días vecinos. */
function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells = Math.ceil(((first.getDay() + 6) % 7 + daysInMonth) / 7) * 7
  return Array.from({ length: cells }, (_, i) => addDays(start, i))
}

const monthLabel = (date: Date) => {
  const text = date.toLocaleDateString("es-MX", { month: "long", year: "numeric" })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

interface CalendarProps {
  selected: Date
  onSelect: (date: Date) => void
  /** Marca con un punto los días que tienen algo (p. ej. citas). */
  hasMarker?: (date: Date) => boolean
  className?: string
}

/**
 * Calendario mensual compacto (lunes primero, en español). Hoy va en círculo
 * verde, el día elegido en tinte verde; las flechas del teclado mueven el foco
 * entre días y Enter elige.
 */
export function Calendar({ selected, onSelect, hasMarker, className }: CalendarProps) {
  const today = React.useMemo(() => new Date(), [])
  const [month, setMonth] = React.useState(() => new Date(selected.getFullYear(), selected.getMonth(), 1))
  const [focusDate, setFocusDate] = React.useState<Date>(selected)
  const gridRef = React.useRef<HTMLDivElement>(null)
  const shouldFocusRef = React.useRef(false)

  const days = React.useMemo(() => monthGrid(month), [month])
  // El día alcanzable con Tab: el enfocado si está en este mes; si no, el día 1.
  const tabbableDate =
    focusDate.getMonth() === month.getMonth() && focusDate.getFullYear() === month.getFullYear() ? focusDate : month

  // Tras moverse con el teclado, el foco sigue al día activo.
  React.useEffect(() => {
    if (!shouldFocusRef.current) return
    shouldFocusRef.current = false
    gridRef.current?.querySelector<HTMLButtonElement>('[data-focus-target="true"]')?.focus()
  }, [focusDate, month])

  const moveFocus = (next: Date) => {
    shouldFocusRef.current = true
    setFocusDate(next)
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1))
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (event.key in steps) {
      event.preventDefault()
      moveFocus(addDays(focusDate, steps[event.key]))
    } else if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault()
      const next = new Date(focusDate)
      next.setMonth(next.getMonth() + (event.key === "PageUp" ? -1 : 1))
      moveFocus(next)
    }
  }

  const shiftMonth = (step: number) => setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + step, 1))

  return (
    <div className={cn("w-[17.5rem] select-none", className)}>
      <div className="mb-2 flex items-center justify-between">
        <span className="pl-1 text-sm font-semibold tracking-tight" aria-live="polite">
          {monthLabel(month)}
        </span>
        <div className="flex items-center">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => shiftMonth(-1)} aria-label="Mes anterior" className="text-muted-foreground">
            <ChevronLeft />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => shiftMonth(1)} aria-label="Mes siguiente" className="text-muted-foreground">
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-medium text-muted-foreground">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div ref={gridRef} role="grid" aria-label={monthLabel(month)} className="grid grid-cols-7 gap-y-0.5" onKeyDown={onKeyDown}>
        {days.map((day) => {
          const inMonth = day.getMonth() === month.getMonth()
          const isToday = isSameDay(day, today)
          const isSelected = isSameDay(day, selected)
          const isFocusTarget = isSameDay(day, tabbableDate) && inMonth
          return (
            <button
              key={day.toISOString()}
              type="button"
              role="gridcell"
              tabIndex={isFocusTarget ? 0 : -1}
              data-focus-target={isFocusTarget}
              aria-selected={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={day.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              onClick={() => onSelect(day)}
              className={cn(
                "relative mx-auto flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-95",
                !inMonth && "text-muted-foreground/40",
                inMonth && !isToday && !isSelected && "text-foreground hover:bg-muted",
                isSelected && !isToday && "bg-primary/10 font-semibold text-primary hover:bg-primary/15",
                isToday && "bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
                isToday && isSelected && "ring-2 ring-primary/30 ring-offset-2 ring-offset-popover"
              )}
            >
              {day.getDate()}
              {hasMarker?.(day) && (
                <span
                  className={cn("absolute bottom-1 size-1 rounded-full", isToday ? "bg-primary-foreground" : "bg-primary")}
                  aria-hidden="true"
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
        {hasMarker ? (
          <span className="flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Días con citas
          </span>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary"
          onClick={() => {
            setMonth(new Date(today.getFullYear(), today.getMonth(), 1))
            onSelect(today)
          }}
        >
          Hoy
        </Button>
      </div>
    </div>
  )
}
