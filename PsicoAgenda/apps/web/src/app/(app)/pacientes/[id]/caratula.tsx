"use client"

import * as React from "react"
import Link from "next/link"
import { Archive, Loader2, Printer } from "lucide-react"
import { RecordStatus, type ClinicalRecord, type Patient } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatShortDate } from "@/lib/format"
import { clinicalRecordService } from "@/services"

export const folioDe = (folio: number) => `EXP-${String(folio).padStart(6, "0")}`

/** Edad cumplida; la fecha de nacimiento es un DATE (medianoche UTC). */
export function edadDe(birthDate?: Date): number | null {
  if (!birthDate) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - birthDate.getUTCFullYear()
  const m = hoy.getMonth() - birthDate.getUTCMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < birthDate.getUTCDate())) edad--
  return edad
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{valor || "—"}</dd>
    </div>
  )
}

/**
 * Carátula del expediente (NOM-004 5.2): establecimiento, profesional
 * responsable y ficha de identificación del paciente, con su número de expediente.
 */
export function Caratula({
  patient,
  record,
  onRecord,
}: {
  patient: Patient
  record: ClinicalRecord
  onRecord: (record: ClinicalRecord) => void
}) {
  const [baja, setBaja] = React.useState(false)
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const edad = edadDe(patient.birthDate)
  const f = record.facility
  const inactivo = record.status === RecordStatus.INACTIVE

  const darDeBaja = async () => {
    setGuardando(true)
    setError(null)
    try {
      onRecord(await clinicalRecordService.darDeBaja(patient.id))
      setBaja(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo dar de baja.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section aria-labelledby="caratula-titulo" className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Expediente clínico</p>
          <h2 id="caratula-titulo" className="font-mono text-lg font-semibold tracking-tight text-foreground">
            {folioDe(record.folio)}
          </h2>
          <p className="text-xs text-muted-foreground">
            Abierto el {formatShortDate(record.openedAt)}
            {inactivo && record.retainUntil && ` · Inactivo, se conserva hasta el ${formatShortDate(record.retainUntil)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/pacientes/${patient.id}/imprimir`}>
              <Printer />
              Imprimir expediente
            </Link>
          </Button>
          {!inactivo && (
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setBaja(true)}>
              <Archive />
              Dar de baja
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-5 border-t border-border/60 pt-4 md:grid-cols-2">
        <dl className="grid grid-cols-2 gap-3">
          <Dato etiqueta="Establecimiento" valor={f.name} />
          <Dato etiqueta="Tipo" valor={f.type} />
          <div className="col-span-2">
            <Dato etiqueta="Domicilio del consultorio" valor={f.address} />
          </div>
          <Dato etiqueta="Psicóloga responsable" valor={f.psychologistName} />
          <Dato etiqueta="Cédula profesional" valor={f.licenseNumber} />
          {(!f.name || !f.address) && (
            <p className="col-span-2 text-xs text-muted-foreground">
              Faltan datos del consultorio.{" "}
              <Link href="/perfil" className="font-medium text-primary hover:underline">
                Complétalos en Configuración
              </Link>
              .
            </p>
          )}
        </dl>
        <dl className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Dato etiqueta="Paciente" valor={patient.name} />
          </div>
          <Dato etiqueta="Edad" valor={edad !== null ? `${edad} años` : undefined} />
          <Dato etiqueta="Sexo" valor={patient.gender} />
          <div className="col-span-2">
            <Dato etiqueta="Domicilio" valor={patient.address} />
          </div>
        </dl>
      </div>

      <Dialog open={baja} onOpenChange={(v) => !guardando && setBaja(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dar de baja a {patient.name}</DialogTitle>
            <DialogDescription>
              Deja de aparecer en tu lista de pacientes, pero no se borra nada: su expediente se conserva 5 años, como
              pide la NOM-004.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" disabled={guardando} onClick={() => setBaja(false)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={guardando} aria-busy={guardando} onClick={() => void darDeBaja()}>
              {guardando && <Loader2 className="animate-spin" />}
              Dar de baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
