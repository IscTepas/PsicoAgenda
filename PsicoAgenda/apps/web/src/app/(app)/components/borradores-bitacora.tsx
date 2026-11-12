"use client"

import * as React from "react"
import { NotebookPen } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  EVENTO_BORRADORES,
  borrarBorrador,
  listarBorradores,
  type BorradorDeHoja,
} from "@/lib/borradores-bitacora"
import { LibretaSesionDialog } from "./libreta-sesion"

/** Recordatorio de hojas de bitácora que quedaron a medias: se retoman o se descartan desde aquí. */
export function BorradoresDeBitacora() {
  const [borradores, setBorradores] = React.useState<BorradorDeHoja[]>([])
  const [abierto, setAbierto] = React.useState<BorradorDeHoja | null>(null)

  React.useEffect(() => {
    // Solo se actualiza si la lista cambió de verdad: guardar un borrador idéntico no vuelve a pintar.
    const leer = () =>
      setBorradores((prev) => {
        const next = listarBorradores()
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next
      })
    leer()
    window.addEventListener(EVENTO_BORRADORES, leer)
    window.addEventListener("storage", leer)
    return () => {
      window.removeEventListener(EVENTO_BORRADORES, leer)
      window.removeEventListener("storage", leer)
    }
  }, [])

  return (
    <>
      {borradores.length > 0 && (
        <section
          aria-label="Hojas de bitácora sin guardar"
          className="space-y-2 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <NotebookPen className="size-4" aria-hidden="true" />
            {borradores.length === 1
              ? "Tienes una hoja de bitácora sin guardar"
              : `Tienes ${borradores.length} hojas de bitácora sin guardar`}
          </p>
          <ul className="space-y-2">
            {borradores.map((borrador) => (
              <li key={borrador.clave} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">
                  {borrador.patientName ?? "Paciente"} · sesión del{" "}
                  {new Date(borrador.sessionDate).toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (window.confirm("¿Descartar lo que escribiste en esta hoja? No se puede recuperar.")) {
                        borrarBorrador(borrador.clave)
                      }
                    }}
                  >
                    Descartar
                  </Button>
                  <Button type="button" size="sm" onClick={() => setAbierto(borrador)}>
                    Continuar y guardar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {abierto && (
        <LibretaSesionDialog
          key={abierto.clave}
          open
          onOpenChange={(open) => !open && setAbierto(null)}
          patientId={abierto.patientId}
          patientName={abierto.patientName}
          appointmentId={abierto.appointmentId}
          sessionDate={new Date(abierto.sessionDate)}
          entryId={abierto.appointmentId ? undefined : abierto.entryId}
          // Una nota suelta nueva no tiene nada que buscar: empieza del borrador.
          entry={abierto.appointmentId || abierto.entryId ? undefined : null}
        />
      )}
    </>
  )
}
