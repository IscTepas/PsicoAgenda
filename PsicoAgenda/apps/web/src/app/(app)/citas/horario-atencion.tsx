"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Save } from "lucide-react"
import type { PsychologistSchedule } from "@psicoagenda/shared"
import { AvailabilityScheduler } from "@/components/motion/availability-scheduler"
import type { WeekAvailability } from "@/components/motion/availability-scheduler/types"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/toast-provider"
import { LocaleProvider } from "@/lib/i18n"
import { franjasDesdeSemana, problemaDeSemana, semanaDesdeFranjas } from "@/lib/horario"
import { psychologistService } from "@/services"

export const CLAVE_HORARIO = ["psicologo", "horario"]

const ETIQUETAS = {
  toggleDay: "Atender el {day}",
  unavailable: "No atiendes",
  addTime: "Agregar horario",
  addRange: "Agregar otro horario al {day}",
  remove: "Quitar",
  removeRange: "Quitar este horario",
  copyTimes: "Copiar horario",
  copyDay: "Copiar el horario del {day} a otros días",
  copyTo: "Copiar a",
  everyDay: "Todos los días",
  apply: "Aplicar",
}

/**
 * Horario disponible: cada día se prende o apaga y se le ponen uno o más
 * horarios (p. ej. 9:00–14:00 y 16:00–19:00). Los pacientes solo pueden pedir
 * cita dentro de estas horas; cada hora es el inicio de una sesión.
 */
export function HorarioAtencion({ horario }: { horario: PsychologistSchedule | undefined }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  // El borrador nace del horario guardado; `null` = sin cambios.
  const [borrador, setBorrador] = useState<WeekAvailability | null>(null)
  const [error, setError] = useState<string | null>(null)
  const semana = borrador ?? (horario ? semanaDesdeFranjas(horario.slots) : null)

  const guardar = useMutation({
    mutationFn: (franjas: { dayOfWeek: number; hour: number }[]) => psychologistService.updateMySchedule(franjas),
    onSuccess: (guardado) => {
      queryClient.setQueryData(CLAVE_HORARIO, guardado)
      setBorrador(null)
      toast({
        title: "Horario guardado",
        description: "Las citas ya agendadas se conservan aunque queden fuera del horario nuevo.",
        status: "success",
      })
    },
    onError: (err) =>
      toast({
        title: "No se pudo guardar el horario",
        description: err instanceof Error ? err.message : "Intenta de nuevo.",
        status: "error",
      }),
  })

  const enviar = () => {
    if (!borrador) return
    const { franjas, error: problema } = franjasDesdeSemana(borrador)
    if (problema) {
      setError(problema)
      return
    }
    setError(null)
    guardar.mutate(franjas)
  }

  return (
    <section aria-labelledby="disp-horario" className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="disp-horario" className="text-base font-semibold text-foreground">
            Horario disponible
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Prende los días que atiendes y ajusta sus horas. Puedes poner varios horarios en un día y copiarlos a
            otros días. Los pacientes solo pueden pedir cita dentro de estas horas.
          </p>
        </div>
      </div>

      {!semana ? (
        <p className="mt-4 text-sm text-muted-foreground">Cargando horario…</p>
      ) : (
        <>
          <LocaleProvider locale="es-MX">
            <AvailabilityScheduler
              className="mt-4"
              value={semana}
              onChange={(siguiente) => {
                setBorrador(siguiente)
                // Se avisa al momento, no hasta guardar.
                setError(problemaDeSemana(siguiente))
              }}
              step={60}
              labels={ETIQUETAS}
            />
          </LocaleProvider>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p role="alert" className="text-sm text-destructive">
              {error ?? ""}
            </p>
            {borrador && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={guardar.isPending}
                  onClick={() => {
                    setBorrador(null)
                    setError(null)
                  }}
                >
                  Descartar cambios
                </Button>
                <Button type="button" onClick={enviar} disabled={guardar.isPending || Boolean(error)} aria-busy={guardar.isPending}>
                  {guardar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
                  Guardar horario
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}
