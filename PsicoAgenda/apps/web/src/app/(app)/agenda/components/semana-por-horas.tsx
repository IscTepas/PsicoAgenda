"use client"

import * as React from "react"
import { Lock, Plus } from "lucide-react"
import { AppointmentStatus, type AgendaBlock, type Appointment } from "@psicoagenda/shared"
import { formatAppointmentTime } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Alto de una hora en px: con el horario típico (9–19 h) la semana cabe sin desplazarse. */
const HORA_PX = 44
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

const mismoDia = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()


const ESTADO_PUNTO: Partial<Record<AppointmentStatus, string>> = {
  [AppointmentStatus.CONFIRMED]: "bg-primary",
  [AppointmentStatus.PENDING]: "bg-amber-500",
  [AppointmentStatus.COMPLETED]: "bg-muted-foreground/60",
  [AppointmentStatus.NO_SHOW]: "bg-muted-foreground/60",
}

interface Colocada {
  cita: Appointment
  carril: number
  carriles: number
}

/**
 * Reparte en carriles las citas que se enciman: cada grupo de citas que se
 * tocan comparte el ancho de la columna a partes iguales.
 */
export function enCarriles(citas: Appointment[]): Colocada[] {
  const fin = (c: Appointment) => c.startTime.getTime() + c.durationMinutes * 60_000
  const orden = [...citas].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  const salida: Colocada[] = []
  let grupo: Colocada[] = []
  let finGrupo = -Infinity
  const cerrar = () => {
    const carriles = Math.max(1, ...grupo.map((c) => c.carril + 1))
    for (const c of grupo) salida.push({ ...c, carriles })
    grupo = []
  }
  for (const cita of orden) {
    if (cita.startTime.getTime() >= finGrupo && grupo.length > 0) cerrar()
    // El primer carril libre: el que ya terminó antes de que empiece esta cita.
    const ocupados = grupo.filter((c) => fin(c.cita) > cita.startTime.getTime()).map((c) => c.carril)
    let carril = 0
    while (ocupados.includes(carril)) carril++
    grupo.push({ cita, carril, carriles: 1 })
    finGrupo = Math.max(finGrupo, fin(cita))
  }
  if (grupo.length > 0) cerrar()
  return salida
}

export interface SemanaPorHorasProps {
  dias: Date[]
  /** Día que se muestra en celular (una sola columna). */
  diaActivo: Date
  onDiaActivo: (dia: Date) => void
  citas: Appointment[]
  bloqueos: AgendaBlock[]
  /** Horas de atención [inicio, fin) en horas enteras. */
  horario: { inicio: number; fin: number }
  ahora: Date
  nombreDe: (cita: Appointment) => string
  onAbrirCita: (cita: Appointment) => void
  /** Tocar un hueco libre: agendar en ese día y hora. */
  onHueco: (dia: Date, hora: number) => void
  etiquetaHueco: string
}

export function SemanaPorHoras({
  dias,
  diaActivo,
  onDiaActivo,
  citas,
  bloqueos,
  horario,
  ahora,
  nombreDe,
  onAbrirCita,
  onHueco,
  etiquetaHueco,
}: SemanaPorHorasProps) {
  // La rejilla se estira si alguna cita cae fuera del horario de atención.
  const visibles = citas.filter((c) => c.status !== AppointmentStatus.CANCELLED)
  const desde = Math.min(horario.inicio, ...visibles.filter((c) => dias.some((d) => mismoDia(d, c.startTime))).map((c) => c.startTime.getHours()))
  const hasta = Math.max(
    horario.fin,
    ...visibles
      .filter((c) => dias.some((d) => mismoDia(d, c.startTime)))
      .map((c) => Math.ceil(c.startTime.getHours() + (c.startTime.getMinutes() + c.durationMinutes) / 60)),
  )
  const horas = Array.from({ length: Math.max(1, hasta - desde) }, (_, i) => desde + i)
  const alto = horas.length * HORA_PX
  const yDe = (fecha: Date) => ((fecha.getHours() - desde) * 60 + fecha.getMinutes()) * (HORA_PX / 60)

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      {/* Celular: una columna; se cambia de día con estas pastillas. */}
      <div className="flex gap-1 overflow-x-auto border-b border-border/50 p-2 [scrollbar-width:none] md:hidden" role="tablist" aria-label="Día">
        {dias.map((dia, i) => {
          const activo = mismoDia(dia, diaActivo)
          return (
            <button
              key={dia.toISOString()}
              type="button"
              role="tab"
              aria-selected={activo}
              onClick={() => onDiaActivo(dia)}
              className={cn(
                "flex min-w-11 flex-1 flex-col items-center rounded-xl py-1.5 text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40",
                activo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {DIAS[i]}
              <span className="text-sm font-semibold tabular-nums">{dia.getDate()}</span>
            </button>
          )
        })}
      </div>

      {/* Encabezado de días (escritorio) */}
      <div className="hidden grid-cols-[3.25rem_repeat(7,minmax(0,1fr))] border-b border-border/50 md:grid">
        <span />
        {dias.map((dia, i) => {
          const hoy = mismoDia(dia, ahora)
          return (
            <div key={dia.toISOString()} className="flex items-baseline gap-1.5 px-2 py-2">
              <span className="text-xs text-muted-foreground">{DIAS[i]}</span>
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                  hoy ? "bg-primary text-primary-foreground" : "text-foreground",
                )}
                aria-current={hoy ? "date" : undefined}
              >
                {dia.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] md:grid-cols-[3.25rem_repeat(7,minmax(0,1fr))]">
        {/* Etiquetas de hora */}
        <div className="relative" style={{ height: alto }} aria-hidden="true">
          {horas.map((hora, i) => (
            <span
              key={hora}
              className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground"
              style={{ top: i * HORA_PX }}
            >
              {i === 0 ? "" : `${hora}:00`}
            </span>
          ))}
        </div>

        {dias.map((dia) => {
          const hoy = mismoDia(dia, ahora)
          const delDia = visibles.filter((c) => mismoDia(c.startTime, dia))
          const bloqueosDelDia = bloqueos.filter((b) => {
            const ini = new Date(dia); ini.setHours(0, 0, 0, 0)
            const fin = new Date(ini); fin.setDate(fin.getDate() + 1)
            return b.startTime < fin && b.endTime > ini
          })
          const ocupada = (hora: number) => {
            const ini = new Date(dia); ini.setHours(hora, 0, 0, 0)
            const fin = new Date(ini); fin.setHours(hora + 1)
            // Una hora que ya empezó no se puede agendar: se ve como pasada, no como hueco.
            if (ini < ahora) return true
            return (
              bloqueosDelDia.some((b) => b.startTime < fin && b.endTime > ini) ||
              delDia.some((c) => c.startTime < fin && new Date(c.startTime.getTime() + c.durationMinutes * 60_000) > ini)
            )
          }

          return (
            <div
              key={dia.toISOString()}
              role="group"
              aria-label={dia.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
              className={cn(
                "relative border-l border-border/40",
                hoy && "bg-primary/[0.03]",
                !mismoDia(dia, diaActivo) && "hidden md:block",
              )}
              style={{
                height: alto,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0 1px, transparent 1px ${HORA_PX}px)`,
              }}
            >
              {/* Huecos libres: el área tocable de cada hora sin cita ni bloqueo. */}
              {horas.map((hora, i) =>
                ocupada(hora) ? null : (
                  <button
                    key={hora}
                    type="button"
                    onClick={() => onHueco(dia, hora)}
                    aria-label={`${etiquetaHueco} el ${dia.toLocaleDateString("es-MX", { weekday: "long", day: "numeric" })} a las ${hora}:00`}
                    className="group absolute inset-x-1 flex items-center justify-center rounded-lg text-primary opacity-0 outline-none transition-opacity duration-150 hover:bg-primary/[0.06] hover:opacity-100 focus-visible:bg-primary/[0.06] focus-visible:opacity-100"
                    style={{ top: i * HORA_PX + 2, height: HORA_PX - 4 }}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                ),
              )}

              {/* Lo que ya pasó: sombreado igual que un bloqueo, sin texto. */}
              {(() => {
                const finDia = new Date(dia); finDia.setHours(desde + horas.length, 0, 0, 0)
                const iniDia = new Date(dia); iniDia.setHours(desde, 0, 0, 0)
                if (ahora <= iniDia) return null
                const alto_ = ahora >= finDia ? alto : yDe(ahora)
                return (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0"
                    style={{
                      height: alto_,
                      backgroundImage:
                        "repeating-linear-gradient(135deg, color-mix(in oklch, var(--muted-foreground) 7%, transparent) 0 6px, transparent 6px 12px)",
                    }}
                    aria-hidden="true"
                  />
                )
              })()}

              {bloqueosDelDia.map((b) => {
                const ini = new Date(dia); ini.setHours(desde, 0, 0, 0)
                const fin = new Date(dia); fin.setHours(desde + horas.length, 0, 0, 0)
                const top = Math.max(0, yDe(b.startTime < ini ? ini : b.startTime))
                const bottom = yDe(b.endTime > fin ? fin : b.endTime)
                if (bottom <= top) return null
                return (
                  <div
                    key={b.id}
                    className="absolute inset-x-1 flex select-none items-start gap-1 overflow-hidden rounded-lg px-1.5 py-1 text-[11px] text-muted-foreground"
                    style={{
                      top,
                      height: bottom - top,
                      backgroundImage:
                        "repeating-linear-gradient(135deg, color-mix(in oklch, var(--muted-foreground) 10%, transparent) 0 6px, transparent 6px 12px)",
                    }}
                    title={b.reason ?? "No disponible"}
                  >
                    <Lock className="mt-px size-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{b.reason ?? "No disponible"}</span>
                  </div>
                )
              })}

              {enCarriles(delDia).map(({ cita, carril, carriles }) => {
                const top = yDe(cita.startTime)
                const height = Math.max(20, (cita.durationMinutes * HORA_PX) / 60 - 2)
                const pendiente = cita.status === AppointmentStatus.PENDING
                return (
                  <button
                    key={cita.id}
                    type="button"
                    onClick={() => onAbrirCita(cita)}
                    className={cn(
                      "absolute flex flex-col overflow-hidden rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight outline-none transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:ring-3 focus-visible:ring-ring/40",
                      pendiente
                        ? "bg-amber-500/15 text-foreground ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/25"
                        : "bg-primary/15 text-foreground hover:bg-primary/25",
                    )}
                    style={{
                      top: top + 1,
                      height,
                      left: `calc(${(carril / carriles) * 100}% + 2px)`,
                      width: `calc(${100 / carriles}% - 4px)`,
                    }}
                  >
                    <span className="flex items-center gap-1 truncate font-medium">
                      <span className={cn("size-1.5 shrink-0 rounded-full", ESTADO_PUNTO[cita.status] ?? "bg-primary")} aria-hidden="true" />
                      <span className="truncate">{nombreDe(cita)}</span>
                    </span>
                    {height >= 30 && <span className="truncate tabular-nums text-muted-foreground">{formatAppointmentTime(cita.startTime)}</span>}
                  </button>
                )
              })}

              {/* Línea de "ahora" en el día de hoy */}
              {hoy && ahora.getHours() >= desde && ahora.getHours() < desde + horas.length && (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: yDe(ahora) }} aria-hidden="true">
                  <span className="-ml-1 size-2 rounded-full bg-primary" />
                  <span className="h-px flex-1 bg-primary" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
