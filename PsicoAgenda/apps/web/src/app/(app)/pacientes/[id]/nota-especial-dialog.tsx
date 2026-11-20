"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"
import type { SessionLogEntry } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { logEntryService } from "@/services"

export type TipoNotaEspecial = "referral" | "discharge"

const TEXTOS: Record<TipoNotaEspecial, { titulo: string; descripcion: string }> = {
  referral: {
    titulo: "Nota de interconsulta o referencia",
    descripcion: "Cuando canalizas al paciente con psiquiatría u otro especialista. Se guarda como borrador; ciérrala para sellarla.",
  },
  discharge: {
    titulo: "Nota de egreso o alta terapéutica",
    descripcion:
      "Al cerrarla, el expediente pasa a inactivo y se conserva 5 años. Se guarda como borrador; ciérrala para sellarla.",
  },
}

/** Notas especiales (NOM-004): interconsulta/referencia y egreso. */
export function NotaEspecialDialog({
  tipo,
  patientId,
  onOpenChange,
  onSaved,
}: {
  tipo: TipoNotaEspecial | null
  patientId: string
  onOpenChange: (open: boolean) => void
  onSaved: (entry: SessionLogEntry) => void
}) {
  const [principal, setPrincipal] = React.useState("")
  const [motivo, setMotivo] = React.useState("")
  const [resumen, setResumen] = React.useState("")
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const id = React.useId()

  if (!tipo) return null
  const esReferencia = tipo === "referral"

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const entry = await logEntryService.create(
        patientId,
        esReferencia
          ? { kind: "referral", referredTo: principal, referralReason: motivo, notes: resumen }
          : { kind: "discharge", dischargeReason: principal, dischargeSummary: resumen, notes: motivo },
      )
      onSaved(entry)
      setPrincipal("")
      setMotivo("")
      setResumen("")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la nota.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !guardando && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <form onSubmit={(e) => void enviar(e)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{TEXTOS[tipo].titulo}</DialogTitle>
            <DialogDescription>{TEXTOS[tipo].descripcion}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-a`}>{esReferencia ? "Se refiere a" : "Motivo del egreso"}</Label>
            <Input
              id={`${id}-a`}
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              required
              maxLength={esReferencia ? 200 : 500}
              placeholder={esReferencia ? "Psiquiatría, Dr. …" : "Alta por cumplimiento de objetivos, abandono, derivación…"}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-b`}>{esReferencia ? "Motivo de la referencia" : "Estado del paciente al egreso"}</Label>
            <Textarea
              id={`${id}-b`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              required
              rows={3}
              maxLength={2000}
              className="rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-c`}>{esReferencia ? "Resumen clínico para el especialista" : "Resumen del tratamiento"}</Label>
            <Textarea
              id={`${id}-c`}
              value={resumen}
              onChange={(e) => setResumen(e.target.value)}
              required
              rows={4}
              maxLength={5000}
              className="rounded-xl"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" disabled={guardando} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={guardando} aria-busy={guardando}>
              {guardando && <Loader2 className="animate-spin" />}
              Guardar borrador
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
