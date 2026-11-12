"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Save } from "lucide-react"
import {
  SCHEDULE_FIRST_HOUR,
  SCHEDULE_LAST_HOUR,
  type PsychologistSchedule,
  type PsychologistScheduleSlot,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/toast-provider"
import { psychologistService } from "@/services"

export const CLAVE_HORARIO = ["psicologo", "horario"]

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
const HORAS = Array.from({ length: SCHEDULE_LAST_HOUR - SCHEDULE_FIRST_HOUR + 1 }, (_, i) => SCHEDULE_FIRST_HOUR + i)

const clave = (dia: number, hora: number) => `${dia}-${hora}`

/** Franjas de una hora → tramos continuos: 09–10, 10–11, 12–13 se leen "9:00 a 11:00 y 12:00 a 13:00". */
function tramosDe(slots: PsychologistScheduleSlot[]): string {
  const ordenados = [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime))
  const tramos: { desde: string; hasta: string }[] = []
  for (const slot of ordenados) {
    const ultimo = tramos.at(-1)
    if (ultimo && ultimo.hasta === slot.startTime) ultimo.hasta = slot.endTime
    else tramos.push({ desde: slot.startTime, hasta: slot.endTime })
  }
  const sinCero = (h: string) => h.slice(0, 5).replace(/^0/, "")
  return tramos.map((t) => `${sinCero(t.desde)} a ${sinCero(t.hasta)}`).join(" y ")
}

/** Horario semanal: se lee como resumen y se edita marcando las horas de cada día. */
export function HorarioAtencion({ horario }: { horario: PsychologistSchedule | undefined }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  // `null` = solo lectura; con valor, las franjas marcadas mientras se edita.
  const [borrador, setBorrador] = useState<Set<string> | null>(null)

  const guardar = useMutation({
    mutationFn: (marcadas: Set<string>) =>
      psychologistService.updateMySchedule(
        [...marcadas].map((c) => {
          const [dayOfWeek, hour] = c.split("-").map(Number)
          return { dayOfWeek, hour }
        }),
      ),
    onSuccess: (guardado) => {
      queryClient.setQueryData(CLAVE_HORARIO, guardado)
      setBorrador(null)
      toast({
        title: "Horario actualizado",
        description: "Las citas ya agendadas se conservan aunque queden fuera del horario nuevo.",
        status: "success",
      })
    },
    onError: (error) =>
      toast({
        title: "No se pudo guardar el horario",
        description: error instanceof Error ? error.message : "Intenta de nuevo.",
        status: "error",
      }),
  })

  const empezarAEditar = () =>
    setBorrador(new Set((horario?.slots ?? []).map((s) => clave(s.dayOfWeek, Number(s.startTime.slice(0, 2))))))

  const alternar = (c: string) =>
    setBorrador((previo) => {
      const siguiente = new Set(previo)
      if (siguiente.has(c)) siguiente.delete(c)
      else siguiente.add(c)
      return siguiente
    })

  // Marca o limpia el día completo: lo usual es abrir o cerrar un día entero (p. ej. un sábado).
  const alternarDia = (dia: number, marcar: boolean) =>
    setBorrador((previo) => {
      const siguiente = new Set(previo)
      for (const hora of HORAS) {
        if (marcar) siguiente.add(clave(dia, hora))
        else siguiente.delete(clave(dia, hora))
      }
      return siguiente
    })

  return (
    <section aria-labelledby="disp-horario" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="disp-horario" className="text-base font-semibold text-foreground">
            Tu horario de atención
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {borrador
              ? "Marca las horas en las que recibes citas. Cada hora es el inicio de una sesión."
              : "Los pacientes solo pueden pedir cita dentro de estas horas."}
          </p>
        </div>
        {horario && !borrador && (
          <Button type="button" variant="outline" onClick={empezarAEditar} className="h-10 rounded-xl px-4">
            <Pencil className="size-4" />
            Editar horario
          </Button>
        )}
      </div>

      {!horario ? (
        <p className="mt-4 text-sm text-muted-foreground">Cargando horario…</p>
      ) : borrador ? (
        <form
          className="mt-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            guardar.mutate(borrador)
          }}
        >
          <div className="divide-y divide-border border-y border-border">
            {DIAS_SEMANA.map((nombre, indice) => {
              const dia = indice + 1
              const marcadas = HORAS.filter((hora) => borrador.has(clave(dia, hora))).length
              return (
                <fieldset key={nombre} className="grid gap-2 py-3 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-4">
                  <legend className="sr-only">{nombre}</legend>
                  <div className="flex items-baseline justify-between gap-2 sm:block">
                    <p className="text-sm font-medium text-foreground" aria-hidden="true">
                      {nombre}
                    </p>
                    <button
                      type="button"
                      onClick={() => alternarDia(dia, marcadas === 0)}
                      className="rounded text-xs text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {marcadas === 0 ? "Atender este día" : "No atender"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {HORAS.map((hora) => {
                      const c = clave(dia, hora)
                      const activa = borrador.has(c)
                      return (
                        <button
                          key={c}
                          type="button"
                          aria-pressed={activa}
                          aria-label={`${nombre}, ${hora}:00`}
                          onClick={() => alternar(c)}
                          className={`h-9 min-w-[3.25rem] rounded-lg border px-2 text-xs font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                            activa
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {hora}:00
                        </button>
                      )
                    })}
                  </div>
                </fieldset>
              )
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p role="alert" className="text-sm text-destructive">
              {borrador.size === 0 ? "Deja al menos una hora de atención en la semana." : ""}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={guardar.isPending}
                onClick={() => setBorrador(null)}
                className="h-11 rounded-xl px-4"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={borrador.size === 0 || guardar.isPending}
                className="h-11 rounded-xl px-6 font-semibold"
              >
                <Save className="size-4" />
                {guardar.isPending ? "Guardando..." : "Guardar horario"}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
          {DIAS_SEMANA.map((nombre, indice) => {
            const slots = horario.slots.filter((s) => s.dayOfWeek === indice + 1)
            return (
              <div key={nombre} className="flex items-baseline justify-between gap-4 border-b border-border py-2.5">
                <dt className="text-sm text-foreground">{nombre}</dt>
                <dd className={`text-right text-sm tabular-nums ${slots.length ? "text-foreground" : "text-muted-foreground"}`}>
                  {slots.length ? tramosDe(slots) : "No atiendes"}
                </dd>
              </div>
            )
          })}
        </dl>
      )}
    </section>
  )
}
