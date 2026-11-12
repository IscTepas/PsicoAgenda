"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import type { TutoredPatient } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WheelDatePicker } from "@/components/wheel-date-picker"
import { PARENTESCOS_TUTOR, ParentescoSelect } from "@/components/parentesco-select"
import { patientService } from "@/services"


/** Un paciente adulto registra a un menor a su cargo para pedir citas a su nombre. */
export function AgregarMenorDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded?: (menor: TutoredPatient) => void
}) {
  const queryClient = useQueryClient()
  const [anio] = React.useState(() => new Date().getFullYear())
  const [name, setName] = React.useState("")
  const [birthDate, setBirthDate] = React.useState("")
  const [relationship, setRelationship] = React.useState(PARENTESCOS_TUTOR[0])
  const [intento, setIntento] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  const errorNombre = intento && name.trim().length < 2 ? "Escribe su nombre completo." : null
  const errorFecha = intento && !birthDate ? "Elige su fecha de nacimiento." : null

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation() // El diálogo vive dentro del formulario de la cita.
    setIntento(true)
    setError(null)
    if (name.trim().length < 2 || !birthDate) return

    setIsSaving(true)
    try {
      const menor = await patientService.addTutored({ name: name.trim(), birthDate, relationship: relationship.trim() || undefined })
      queryClient.setQueryData<TutoredPatient[]>(["pacientes", "tutelados"], (prev = []) => [...prev, menor])
      onAdded?.(menor)
      onOpenChange(false)
      setName("")
      setBirthDate("")
      setIntento(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo registrar al menor.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSaving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">Agregar a un menor a tu cargo</DialogTitle>
          <DialogDescription>
            No necesita cuenta propia: tú pides y llevas sus citas desde la tuya hasta que cumpla 18 años.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="menor-nombre">Nombre completo del menor</Label>
            <Input
              id="menor-nombre"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              autoComplete="off"
              aria-invalid={Boolean(errorNombre)}
              aria-describedby={errorNombre ? "menor-nombre-error" : undefined}
              disabled={isSaving}
            />
            {errorNombre && (
              <p id="menor-nombre-error" role="alert" className="text-sm text-destructive">
                {errorNombre}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="menor-nacimiento">Fecha de nacimiento</Label>
            <WheelDatePicker
              id="menor-nacimiento"
              value={birthDate}
              onChange={setBirthDate}
              defaultYear={anio - 10}
              fromYear={anio - 17}
              toYear={anio}
              placeholder="Elige su fecha"
              invalid={Boolean(errorFecha)}
            />
            {errorFecha && (
              <p role="alert" className="text-sm text-destructive">
                {errorFecha}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">Tú eres su…</p>
            <ParentescoSelect
              value={relationship}
              onChange={setRelationship}
              opciones={PARENTESCOS_TUTOR}
              ariaLabel="Tu parentesco con el menor"
              disabled={isSaving}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} aria-busy={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  Guardando…
                </>
              ) : (
                "Agregar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
