"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CalendarOff, Loader2, Trash2 } from "lucide-react"
import type { AgendaBlock } from "@psicoagenda/shared"
import { Calendar } from "@/components/arc/calendar/calendar"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/toast-provider"
import { useHydrated } from "@/lib/use-hydrated"
import { agendaBlockService, psychologistService } from "@/services"
import { BloqueoAgendaModal } from "../agenda/components/bloqueo-agenda-modal"
import { CLAVE_HORARIO, HorarioAtencion } from "./horario-atencion"

const CLAVE = ["bloqueos", "proximos"]
const DIA_MS = 24 * 60 * 60_000

const inicioDeHoy = () => {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  return hoy
}

// Desde hoy y un año adelante: lo ya pasado no se puede desbloquear ni afecta a nadie.
const listarProximos = () => {
  const desde = inicioDeHoy()
  const hasta = new Date(desde)
  hasta.setFullYear(hasta.getFullYear() + 1)
  return agendaBlockService.list({ from: desde, to: hasta })
}

const dia = (fecha: Date) => fecha.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
const diaCorto = (fecha: Date) => fecha.toLocaleDateString("es-MX", { day: "numeric", month: "long" })
const hora = (fecha: Date) => fecha.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
const mesDe = (fecha: Date) => fecha.toLocaleDateString("es-MX", { month: "long", year: "numeric" })

// Un día completo termina a las 00:00 del día siguiente: el último día bloqueado es el anterior.
const ultimoDia = (bloqueo: AgendaBlock) => new Date(bloqueo.endTime.getTime() - 1)
const diasDe = (bloqueo: AgendaBlock) => Math.max(1, Math.round((bloqueo.endTime.getTime() - bloqueo.startTime.getTime()) / DIA_MS))

/** "lunes, 16 de noviembre" · "del 16 al 20 de noviembre" · "… de 10:00 a 12:00". */
function cuando(bloqueo: AgendaBlock): string {
  if (!bloqueo.allDay) return `${dia(bloqueo.startTime)}, de ${hora(bloqueo.startTime)} a ${hora(bloqueo.endTime)}`
  return diasDe(bloqueo) === 1
    ? dia(bloqueo.startTime)
    : `Del ${diaCorto(bloqueo.startTime)} al ${diaCorto(ultimoDia(bloqueo))}`
}

const detalle = (bloqueo: AgendaBlock) =>
  [
    !bloqueo.allDay ? "Solo esas horas" : diasDe(bloqueo) === 1 ? "Todo el día" : `${diasDe(bloqueo)} días completos`,
    bloqueo.reason,
  ]
    .filter(Boolean)
    .join(" · ")

/** El bloqueo toca ese día (cualquier hora). */
const tocaElDia = (bloqueo: AgendaBlock, fecha: Date) => {
  const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime()
  return bloqueo.startTime.getTime() < inicio + DIA_MS && bloqueo.endTime.getTime() > inicio
}

/** Cuándo atiende la psicóloga: los días u horas que bloqueó, y el horario semanal sobre el que caen. */
export function Disponibilidad() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const hydrated = useHydrated()
  const [seleccion, setSeleccion] = useState<Date | undefined>(undefined)
  const [modal, setModal] = useState<{ key: number; fecha?: Date } | null>(null)
  const [porConfirmar, setPorConfirmar] = useState<string | null>(null)

  const { data: bloqueos, isError } = useQuery({ queryKey: CLAVE, queryFn: listarProximos })
  const { data: horario } = useQuery({
    queryKey: CLAVE_HORARIO,
    queryFn: () => psychologistService.getMySchedule(),
    staleTime: 10 * 60_000,
  })

  const eliminar = useMutation({
    mutationFn: (id: string) => agendaBlockService.remove(id),
    onSuccess: (_nada, id) => {
      queryClient.setQueryData<AgendaBlock[]>(CLAVE, (lista = []) => lista.filter((b) => b.id !== id))
      setPorConfirmar(null)
      toast({ title: "Bloqueo eliminado", description: "Ese horario vuelve a estar disponible.", status: "success" })
    },
    onError: (error) =>
      toast({
        title: "No se pudo eliminar el bloqueo",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        status: "error",
      }),
  })

  const ordenados = [...(bloqueos ?? [])].sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
  const delDia = (fecha: Date) => ordenados.filter((b) => tocaElDia(b, fecha))
  // JS: 0 = domingo; el horario guarda 1 = lunes … 7 = domingo.
  const atiende = (fecha: Date) => !horario || horario.slots.some((s) => s.dayOfWeek === (fecha.getDay() || 7))

  const abrirModal = (fecha?: Date) => setModal((previo) => ({ key: (previo?.key ?? 0) + 1, fecha }))

  // Un día libre se bloquea de un toque; uno ya bloqueado se selecciona para ver su detalle.
  const elegirDia = (fecha: Date) => {
    setPorConfirmar(null)
    if (delDia(fecha).length > 0) setSeleccion(fecha)
    else {
      setSeleccion(undefined)
      abrirModal(fecha)
    }
  }

  const porMes = new Map<string, AgendaBlock[]>()
  for (const bloqueo of ordenados) {
    const clave = mesDe(bloqueo.startTime)
    porMes.set(clave, [...(porMes.get(clave) ?? []), bloqueo])
  }

  const fila = (bloqueo: AgendaBlock) => (
    <li key={bloqueo.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <button
        type="button"
        onClick={() => setSeleccion(new Date(bloqueo.startTime))}
        className="min-w-0 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="block text-sm font-medium text-foreground first-letter:uppercase">{cuando(bloqueo)}</span>
        <span className="block text-sm text-muted-foreground">{detalle(bloqueo)}</span>
      </button>

      {porConfirmar === bloqueo.id ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={eliminar.isPending}
            onClick={() => eliminar.mutate(bloqueo.id)}
            className="h-10"
          >
            {eliminar.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Sí, eliminar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={eliminar.isPending}
            onClick={() => setPorConfirmar(null)}
            className="h-10"
          >
            Conservar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Eliminar el bloqueo: ${cuando(bloqueo)}`}
          onClick={() => setPorConfirmar(bloqueo.id)}
          className="h-10 shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" />
          Eliminar
        </Button>
      )}
    </li>
  )

  const bloqueosDeSeleccion = seleccion ? delDia(seleccion) : []

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        {/* Calendario: el mes de un vistazo, y el lugar desde donde se bloquea */}
        <section aria-labelledby="disp-calendario" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="disp-calendario" className="sr-only">
            Calendario de bloqueos
          </h2>
          {hydrated ? (
            <Calendar
              className="mx-auto"
              value={seleccion}
              onChange={elegirDia}
              minDate={inicioDeHoy()}
              isFilled={(fecha) => delDia(fecha).some((b) => b.allDay)}
              hasMarker={(fecha) => delDia(fecha).length > 0 && !delDia(fecha).some((b) => b.allDay)}
              isDimmed={(fecha) => !atiende(fecha)}
              showToday
            />
          ) : (
            <div className="mx-auto h-80 max-w-[328px] animate-pulse rounded-xl bg-muted/30" aria-hidden="true" />
          )}

          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded-full border border-border bg-muted" aria-hidden="true" />
              Día bloqueado
            </li>
            <li className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Algunas horas
            </li>
            <li className="flex items-center gap-1.5">
              <span className="font-medium opacity-40" aria-hidden="true">
                12
              </span>
              No atiendes
            </li>
          </ul>

          {/* Detalle del día elegido; sin elegir, la pista de cómo se bloquea */}
          <div className="mt-4 border-t border-border pt-4" aria-live="polite">
            {seleccion && bloqueosDeSeleccion.length > 0 ? (
              <>
                <p className="text-sm font-medium text-foreground first-letter:uppercase">{dia(seleccion)}</p>
                <ul className="divide-y divide-border">{bloqueosDeSeleccion.map(fila)}</ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Toca un día libre para bloquearlo, o uno bloqueado para ver su detalle.
              </p>
            )}
          </div>
        </section>

        {/* Próximos bloqueos, agrupados por mes */}
        <section aria-labelledby="disp-proximos" className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="disp-proximos" className="text-base font-semibold text-foreground">
              Próximos bloqueos
            </h2>
            <Button type="button" onClick={() => abrirModal()} className="h-10 rounded-xl px-4 font-semibold">
              <CalendarOff className="size-4" />
              Bloquear agenda
            </Button>
          </div>

          {isError ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              No se pudieron cargar los bloqueos. Recarga la página para intentarlo de nuevo.
            </p>
          ) : bloqueos === undefined ? (
            <p className="mt-6 text-sm text-muted-foreground">Cargando bloqueos…</p>
          ) : ordenados.length === 0 ? (
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              No tienes bloqueos próximos. Bloquea vacaciones, días festivos o unas horas sueltas para que no te pidan
              cita en ellos.
            </p>
          ) : (
            <div className="mt-2 space-y-4">
              {[...porMes].map(([mes, lista]) => (
                <div key={mes}>
                  <h3 className="pt-3 text-xs font-medium text-muted-foreground first-letter:uppercase">{mes}</h3>
                  <ul className="divide-y divide-border">{lista.map(fila)}</ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Horario semanal: la base sobre la que caen los bloqueos */}
      <HorarioAtencion horario={horario} />

      {modal && (
        <BloqueoAgendaModal
          key={modal.key}
          open
          onOpenChange={(abierto) => !abierto && setModal(null)}
          defaultDate={modal.fecha}
          onCreated={() => void queryClient.invalidateQueries({ queryKey: CLAVE })}
        />
      )}
    </div>
  )
}
