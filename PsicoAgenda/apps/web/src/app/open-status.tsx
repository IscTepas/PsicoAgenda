"use client"

import { useSyncExternalStore } from "react"
import { cn } from "@/lib/utils"
import type { WeeklyHours } from "./home-content"

const TICK_MS = 60_000
const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

// Reloj por minuto. En el servidor no hay "ahora": el estado se pinta ya hidratado.
function subscribe(onTick: () => void) {
  const id = setInterval(onTick, TICK_MS)
  return () => clearInterval(id)
}
const getSnapshot = () => Math.floor(Date.now() / TICK_MS) * TICK_MS
const getServerSnapshot = () => null

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number)
  return h * 60 + m
}

function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number)
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "a.m." : "p.m."}`
}

/** Día de la semana y minuto del día en la zona horaria del consultorio. */
function zonedNow(timestamp: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(timestamp))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0"
  return { day: WEEKDAY_INDEX[get("weekday")] ?? 0, minutes: Number(get("hour")) * 60 + Number(get("minute")) }
}

function describe(hours: WeeklyHours[], timestamp: number, timeZone: string) {
  const { day, minutes } = zonedNow(timestamp, timeZone)
  const today = hours.find((h) => h.day === day)

  if (today && minutes >= toMinutes(today.opens) && minutes < toMinutes(today.closes)) {
    return { open: true, label: "Abierto ahora", detail: `hasta las ${formatClock(today.closes)}` }
  }
  if (today && minutes < toMinutes(today.opens)) {
    return { open: false, label: "Cerrado", detail: `abre hoy a las ${formatClock(today.opens)}` }
  }
  for (let offset = 1; offset <= 7; offset++) {
    const next = hours.find((h) => h.day === (day + offset) % 7)
    if (next) {
      const when = offset === 1 ? "mañana" : `el ${WEEKDAYS[next.day]}`
      return { open: false, label: "Cerrado", detail: `abre ${when} a las ${formatClock(next.opens)}` }
    }
  }
  return { open: false, label: "Cerrado", detail: "" }
}

export function OpenStatus({ hours, timeZone }: { hours: WeeklyHours[]; timeZone: string }) {
  const timestamp = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (timestamp === null) {
    // Hueco del mismo alto que el estado real para que nada salte al hidratar.
    return <p className="h-5" aria-hidden="true" />
  }

  const status = describe(hours, timestamp, timeZone)

  return (
    <p className="flex h-5 items-center gap-2 text-sm animate-in fade-in duration-300" aria-live="polite">
      <span className="relative flex size-2" aria-hidden="true">
        {status.open && (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50 motion-reduce:hidden" />
        )}
        <span className={cn("relative inline-flex size-2 rounded-full", status.open ? "bg-primary" : "bg-muted-foreground/50")} />
      </span>
      <span className={cn("font-medium", status.open ? "text-primary" : "text-foreground")}>{status.label}</span>
      {status.detail && <span className="text-muted-foreground">· {status.detail}</span>}
    </p>
  )
}
