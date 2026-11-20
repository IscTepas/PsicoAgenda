"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { AlertCircle, CalendarClock, Loader2, X } from "lucide-react"
import { AppointmentRequestStatus, AppointmentStatus, type Appointment } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/toast-provider"
import { formatAppointmentTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { appointmentRequestService, patientService } from "@/services"

const CLAVE = ["solicitudes", "mias"]
const CLAVE_VISTOS = "psicoagenda:cancelaciones-vistas"

const fechaLarga = (d: Date) => {
  const t = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const cuando = (d: Date) => `${fechaLarga(d)} · ${formatAppointmentTime(d)}`

const leerVistos = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_VISTOS) ?? "[]") as string[]
  } catch {
    return []
  }
}

/**
 * Lo que el paciente tiene que atender, arriba de su inicio: citas que canceló
 * la psicóloga (o un bloqueo de agenda), cambios de horario que le propone y sus
 * propias solicitudes. Sin nada pendiente no se muestra.
 */
export function TusSolicitudes({
  appointments,
  onCambio,
}: {
  appointments: Appointment[]
  /** Se aceptó un cambio: hay que volver a pedir las citas. */
  onCambio?: () => void
}) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: requests = [] } = useQuery({ queryKey: CLAVE, queryFn: () => appointmentRequestService.list() })
  const { data: tutored = [] } = useQuery({
    queryKey: ["pacientes", "tutelados"],
    queryFn: patientService.listTutored,
    staleTime: 5 * 60_000,
  })
  const tutoredNames = useMemo(() => new Map(tutored.map((m) => [m.id, m.name])), [tutored])
  const [respondiendo, setRespondiendo] = useState<string | null>(null)
  // Avisos de cancelación que el paciente ya marcó como vistos (solo en este navegador).
  const [vistos, setVistos] = useState<string[]>(leerVistos)

  // Hora de referencia fija al montar: basta para descartar fechas ya pasadas.
  const [ahora] = useState(() => Date.now())

  const propuestas = useMemo(
    () =>
      requests.filter(
        (r) =>
          r.proposedByPsychologist &&
          r.status === AppointmentRequestStatus.PENDING &&
          new Date(r.startTime).getTime() > ahora,
      ),
    [requests, ahora],
  )

  const solicitudes = useMemo(
    () =>
      requests
        .filter(
          (r) =>
            !r.proposedByPsychologist &&
            (r.status === AppointmentRequestStatus.PENDING || r.status === AppointmentRequestStatus.REJECTED) &&
            new Date(r.startTime).getTime() > ahora,
        )
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()),
    [requests, ahora],
  )

  // Canceladas por la psicóloga en la última semana, que el paciente aún no marcó como vistas.
  // Las que se movieron por una propuesta aceptada no cuentan: el paciente ya lo sabe.
  const canceladas = useMemo(
    () =>
      appointments.filter(
        (a) =>
          a.status === AppointmentStatus.CANCELLED &&
          a.cancelledByPsychologist &&
          !vistos.includes(a.id) &&
          (a.cancelledAt ? ahora - a.cancelledAt.getTime() < 7 * 86_400_000 : false),
      ),
    [appointments, vistos, ahora],
  )

  const marcarVisto = (id: string) => {
    const siguientes = [...vistos, id]
    setVistos(siguientes)
    try {
      localStorage.setItem(CLAVE_VISTOS, JSON.stringify(siguientes.slice(-50)))
    } catch {
      // Sin almacenamiento solo se pierde recordar que ya lo vio.
    }
  }

  const responder = async (id: string, accept: boolean) => {
    setRespondiendo(id)
    try {
      await appointmentRequestService.responder(id, accept)
      void queryClient.invalidateQueries({ queryKey: CLAVE })
      onCambio?.()
      toast({
        title: accept ? "Aceptaste el cambio. Tu cita ya está en el nuevo horario." : "Rechazaste el cambio. Tu cita sigue igual.",
        status: "success",
      })
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo responder.", status: "error" })
    } finally {
      setRespondiendo(null)
    }
  }

  const retirar = async (id: string) => {
    try {
      await appointmentRequestService.cancel(id)
      void queryClient.invalidateQueries({ queryKey: CLAVE })
      toast({ title: "Retiraste tu solicitud.", status: "success" })
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "No se pudo retirar la solicitud.", status: "error" })
    }
  }

  if (propuestas.length === 0 && canceladas.length === 0 && solicitudes.length === 0) return null
  const para = (patientId: string) => {
    const nombre = tutoredNames.get(patientId)
    return nombre ? <span className="text-muted-foreground"> · para {nombre}</span> : null
  }

  return (
    <div className="space-y-4">
      {canceladas.map((cita) => (
        <section
          key={cita.id}
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center"
        >
          <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Tu psicóloga canceló tu cita del {cuando(new Date(cita.startTime))}
              {para(cita.patientId)}
            </p>
            {cita.cancellationReason && <p className="text-sm text-muted-foreground">{cita.cancellationReason}</p>}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" asChild>
              <Link href="/agenda/nueva">Pedir otro horario</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => marcarVisto(cita.id)} aria-label="Ya lo vi">
              <X />
              Entendido
            </Button>
          </div>
        </section>
      ))}

      {propuestas.map((p) => (
        <section key={p.id} className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Tu psicóloga propone cambiar tu cita{para(p.patientId)}</p>
              <p className="text-sm text-muted-foreground">
                {p.originalStartTime && (
                  <>
                    De <span className="line-through">{cuando(p.originalStartTime)}</span> a{" "}
                  </>
                )}
                <span className="font-medium text-foreground">{cuando(new Date(p.startTime))}</span>
              </p>
              <p className="text-xs text-muted-foreground">Si la rechazas, tu cita se queda en su horario actual.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" disabled={respondiendo !== null} onClick={() => void responder(p.id, false)}>
              Rechazar
            </Button>
            <Button size="sm" disabled={respondiendo !== null} aria-busy={respondiendo === p.id} onClick={() => void responder(p.id, true)}>
              {respondiendo === p.id && <Loader2 className="animate-spin" />}
              Aceptar cambio
            </Button>
          </div>
        </section>
      ))}

      {solicitudes.length > 0 && (
        <section aria-labelledby="tus-solicitudes" className="space-y-3 rounded-2xl border border-border bg-card p-5">
          <h2 id="tus-solicitudes" className="text-sm font-semibold tracking-tight text-foreground">
            Tus solicitudes
          </h2>
          <ul className="divide-y divide-border">
            {solicitudes.map((request) => {
              const start = new Date(request.startTime)
              const pendiente = request.status === AppointmentRequestStatus.PENDING
              return (
                <li key={request.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {fechaLarga(start)} · <span className="tabular-nums">{formatAppointmentTime(start)}</span>
                      {para(request.patientId)}
                    </p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("size-1.5 rounded-full", pendiente ? "bg-amber-500" : "bg-destructive")} aria-hidden="true" />
                      {pendiente ? "Esperando confirmación" : "No fue aceptada · elige otro horario"}
                    </p>
                  </div>
                  {pendiente ? (
                    <Button size="sm" variant="ghost" onClick={() => void retirar(request.id)}>
                      Retirar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/agenda/nueva">Otro horario</Link>
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}
