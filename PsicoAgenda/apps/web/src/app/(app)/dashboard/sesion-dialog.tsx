"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { CheckCircle2, FileText, Loader2, MapPin, UserX, Video } from "lucide-react"
import { AppointmentModality, AppointmentStatus, ConsentStatus, type Appointment } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatAppointmentTime } from "@/lib/format"
import { clinicalRecordService } from "@/services"
import { CobroDeCita } from "@/components/cobro-cita"

const MINUTO = 60_000
const finDe = (cita: Appointment) => new Date(new Date(cita.startTime).getTime() + cita.durationMinutes * MINUTO)

/**
 * Atender una cita, de principio a fin y en un solo lugar: entrar (sala en línea o
 * consultorio), escribir la nota y cerrar con "Asistió" o "No asistió".
 */
export function SesionDialog({
  cita,
  paciente,
  enlaceVideollamada,
  ahora,
  onClose,
  onBitacora,
  onCerrar,
}: {
  cita: Appointment
  paciente: string
  enlaceVideollamada?: string
  ahora: Date
  onClose: () => void
  /** Abre la libreta de esta cita; al cerrarla se vuelve aquí. */
  onBitacora: () => void
  onCerrar: (asistio: boolean) => Promise<void>
}) {
  const [guardando, setGuardando] = useState<"asistio" | "no" | null>(null)
  const enLinea = cita.modality === AppointmentModality.VIRTUAL
  const inicio = new Date(cita.startTime)
  const yaEmpezo = inicio.getTime() <= ahora.getTime()
  const falta = Math.round((inicio.getTime() - ahora.getTime()) / MINUTO)
  // Solo avisa: la sesión se puede dar igual, pero sin firma no hay respaldo legal.
  const { data: expediente } = useQuery({
    queryKey: ["expediente", cita.patientId],
    queryFn: () => clinicalRecordService.get(cita.patientId),
  })
  const sinConsentimiento = expediente !== undefined && !expediente.consents.some((c) => c.status === ConsentStatus.SIGNED)

  const cerrar = async (asistio: boolean) => {
    setGuardando(asistio ? "asistio" : "no")
    try {
      await onCerrar(asistio)
    } finally {
      setGuardando(null)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !guardando && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">{paciente}</DialogTitle>
          <DialogDescription className="tabular-nums">
            {formatAppointmentTime(inicio)} – {formatAppointmentTime(finDe(cita))} · {enLinea ? "En línea" : "Presencial"}
            {!yaEmpezo && falta > 0 && falta <= 120 && ` · empieza en ${falta} min`}
          </DialogDescription>
        </DialogHeader>

        {cita.reason && <p className="text-sm text-muted-foreground">Motivo: {cita.reason}</p>}
        {cita.status === AppointmentStatus.PENDING && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            Esta cita no estaba confirmada. Al cerrarla queda registrada igual.
          </p>
        )}

        {sinConsentimiento && (
          <p className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Falta el consentimiento informado.</span> Dalo a firmar en esta sesión y
            regístralo en el{" "}
            <Link href={`/pacientes/${cita.patientId}`} className="font-medium text-primary hover:underline">
              expediente
            </Link>
            .
          </p>
        )}

        <div className="space-y-2">
          {/* 1. Entrar */}
          {enLinea ? (
            enlaceVideollamada ? (
              <Button asChild className="w-full">
                <a href={enlaceVideollamada} target="_blank" rel="noopener noreferrer">
                  <Video />
                  Entrar a la videollamada
                </a>
              </Button>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                Aún no tienes enlace de videollamada.{" "}
                <Link href="/citas?seccion=videollamada" className="font-medium text-primary underline-offset-4 hover:underline">
                  Configúralo aquí
                </Link>
                .
              </p>
            )
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" aria-hidden="true" />
              Sesión en el consultorio.
            </p>
          )}

          {/* 2. Nota de la sesión: durante o al terminar. Si no se abre aquí, se abre sola al marcar "Asistió". */}
          <Button variant="outline" className="w-full" onClick={onBitacora}>
            <FileText />
            Escribir en la bitácora
          </Button>
          <p className="text-xs text-muted-foreground">
            Puedes escribir la bitácora durante la sesión. Si no, se abre sola al marcar &quot;Asistió&quot;.
          </p>
        </div>

        {/* 3. Cobro: se puede marcar aquí o después desde Inicio, Agenda o Reportes. */}
        <CobroDeCita cita={cita} />

        {/* 4. Cerrar la sesión */}
        <DialogFooter className="gap-2 border-t border-border pt-4 sm:gap-2">
          <Button variant="outline" onClick={() => cerrar(false)} disabled={guardando !== null} aria-busy={guardando === "no"}>
            {guardando === "no" ? <Loader2 className="animate-spin" /> : <UserX />}
            No asistió
          </Button>
          <Button onClick={() => cerrar(true)} disabled={guardando !== null} aria-busy={guardando === "asistio"}>
            {guardando === "asistio" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
            Asistió · cerrar sesión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const ESTADO_TEXTO: Record<AppointmentStatus, string> = {
  [AppointmentStatus.CONFIRMED]: "Confirmada",
  [AppointmentStatus.PENDING]: "Por confirmar",
  [AppointmentStatus.COMPLETED]: "Asistió",
  [AppointmentStatus.NO_SHOW]: "No asistió",
  [AppointmentStatus.CANCELLED]: "Cancelada",
}

/** Resumen de una cita (solo lectura). Modificarla es un paso aparte y explícito. */
export function DetalleCitaDialog({
  cita,
  paciente,
  onClose,
}: {
  cita: Appointment
  paciente: string
  onClose: () => void
}) {
  const inicio = new Date(cita.startTime)
  const filas: [string, string][] = [
    ["Día", inicio.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })],
    ["Hora", `${formatAppointmentTime(inicio)} – ${formatAppointmentTime(finDe(cita))}`],
    ["Modalidad", cita.modality === AppointmentModality.VIRTUAL ? "En línea" : "Presencial"],
    ["Motivo", cita.reason || "Sin especificar"],
    ["Estado", ESTADO_TEXTO[cita.status]],
  ]
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">{paciente}</DialogTitle>
          <DialogDescription className="sr-only">Detalle de la cita</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-border rounded-xl bg-muted/40 text-sm">
          {filas.map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex items-start justify-between gap-4 px-4 py-2.5">
              <dt className="text-muted-foreground">{etiqueta}</dt>
              <dd className="text-right font-medium text-foreground first-letter:uppercase">{valor}</dd>
            </div>
          ))}
        </dl>
        {cita.status !== AppointmentStatus.PENDING && <CobroDeCita cita={cita} />}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button asChild variant="ghost">
            <Link href={`/agenda/${cita.id}`}>Modificar cita</Link>
          </Button>
          <Button asChild>
            <Link href={`/pacientes/${cita.patientId}`}>Ver expediente</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
