"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { PatientTask } from "@psicoagenda/shared"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/toast-provider"
import { cn } from "@/lib/utils"
import { patientService } from "@/services"

const CLAVE = ["pacientes", "tareas"]

/** Tareas que dejó la psicóloga: el paciente (o su tutor) las palomea. Sin tareas no ocupa lugar. */
export function MisTareas() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: tareas = [] } = useQuery({ queryKey: CLAVE, queryFn: patientService.listTasks, staleTime: 60_000 })

  const marcar = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => patientService.setTaskDone(id, done),
    // La palomita aparece al instante; si el servidor falla, se regresa.
    onMutate: async ({ id, done }) => {
      await queryClient.cancelQueries({ queryKey: CLAVE })
      const previas = queryClient.getQueryData<PatientTask[]>(CLAVE)
      queryClient.setQueryData<PatientTask[]>(CLAVE, (lista = []) =>
        lista.map((t) => (t.id === id ? { ...t, doneAt: done ? new Date() : undefined } : t)),
      )
      return { previas }
    },
    onError: (_error, _vars, contexto) => {
      queryClient.setQueryData(CLAVE, contexto?.previas)
      toast({ title: "No se pudo guardar. Intenta de nuevo.", status: "error" })
    },
  })

  if (tareas.length === 0) return null
  const pendientes = tareas.filter((t) => !t.doneAt).length

  return (
    <section id="tareas" aria-labelledby="tareas-titulo" className="scroll-mt-20 space-y-3 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="tareas-titulo" className="text-base font-semibold text-foreground">
          Tu tarea
        </h2>
        <p className="text-sm text-muted-foreground">
          {pendientes === 0 ? "Todo hecho" : pendientes === 1 ? "1 pendiente" : `${pendientes} pendientes`}
        </p>
      </div>
      <ul className="divide-y divide-border">
        {tareas.map((tarea) => (
          <li key={tarea.id}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
              <Checkbox
                checked={Boolean(tarea.doneAt)}
                onCheckedChange={(value) => marcar.mutate({ id: tarea.id, done: value === true })}
                className="mt-0.5"
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block break-words text-sm", tarea.doneAt ? "text-muted-foreground line-through" : "text-foreground")}>
                  {tarea.text}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {tarea.patientName ? `${tarea.patientName} · ` : ""}
                  Sesión del {tarea.sessionDate.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  )
}
