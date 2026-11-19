"use client"

import * as React from "react"
import { Loader2, UserPlus } from "lucide-react"
import { citaUnicaPacienteSchema } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { TelefonoInput } from "@/components/telefono-input"
import { WheelDatePicker } from "@/components/wheel-date-picker"
import { ApiError } from "@/lib/api-client"
import { patientService } from "@/services"

type Campo = "name" | "phone" | "email" | "birthDate" | "guardianName" | "guardianPhone"

export interface PacienteCitaUnica {
  id: string
  name: string
  phone?: string
  email?: string
  isMinor: boolean
  birthDate?: string
}

/**
 * Alta rápida de una cita única: quien solo quiere una valoración no pasa por el
 * registro. Nombre y teléfono bastan; si es menor, su fecha de nacimiento y su tutor.
 */
export function CitaUnicaAlta({
  onCreado,
  onExistente,
  onCancelar,
}: {
  onCreado: (paciente: PacienteCitaUnica) => void
  /** El teléfono ya es de un paciente: se le agenda a esa persona en lugar de duplicarla. */
  onExistente: (paciente: { id: string; name: string }) => void
  onCancelar: () => void
}) {
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [isMinor, setIsMinor] = React.useState(false)
  const [birthDate, setBirthDate] = React.useState("")
  const [guardianName, setGuardianName] = React.useState("")
  const [guardianPhone, setGuardianPhone] = React.useState("")
  const [errores, setErrores] = React.useState<Partial<Record<Campo, string>>>({})
  const [guardando, setGuardando] = React.useState(false)
  const [existente, setExistente] = React.useState<{ id: string; name: string } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const enviar = async () => {
    setError(null)
    setExistente(null)
    const payload = {
      name,
      phone: isMinor ? undefined : phone || undefined,
      email: email.trim() || undefined,
      isMinor,
      birthDate: isMinor && birthDate ? birthDate : undefined,
      guardian: isMinor ? { name: guardianName, phone: guardianPhone } : undefined,
    }
    const validacion = citaUnicaPacienteSchema.safeParse(payload)
    if (!validacion.success) {
      const nuevos: Partial<Record<Campo, string>> = {}
      for (const issue of validacion.error.issues) {
        const [raiz, sub] = issue.path
        const campo = (raiz === "guardian" ? (sub === "phone" ? "guardianPhone" : "guardianName") : raiz) as Campo
        nuevos[campo] ??= issue.message
      }
      setErrores(nuevos)
      return
    }
    setErrores({})
    setGuardando(true)
    try {
      const creado = await patientService.createOneTime(payload)
      onCreado({ ...creado, phone: isMinor ? guardianPhone : phone, email: payload.email, isMinor, birthDate: payload.birthDate })
    } catch (err) {
      if (err instanceof ApiError && err.code === "PACIENTE_EXISTENTE") {
        setExistente(err.details as { id: string; name: string })
      } else {
        setError(err instanceof Error ? err.message : "No se pudo dar de alta. Intenta de nuevo.")
      }
    } finally {
      setGuardando(false)
    }
  }

  const ayuda = (campo: Campo, texto?: string) =>
    errores[campo] ? (
      <p className="text-xs text-destructive">{errores[campo]}</p>
    ) : texto ? (
      <p className="text-xs text-muted-foreground">{texto}</p>
    ) : null

  return (
    <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Cita única, sin registro</p>
        <p className="text-xs text-muted-foreground">
          Para una valoración o una sola sesión. Si después quiere seguir, podrás invitarle a crear su cuenta.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <label htmlFor="cu-nombre" className="text-sm font-medium text-foreground">
            Nombre completo
          </label>
          <Input id="cu-nombre" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" aria-invalid={Boolean(errores.name)} />
          {ayuda("name")}
        </div>

        <label className="flex items-center gap-2.5 text-sm text-foreground sm:col-span-2">
          <Checkbox checked={isMinor} onCheckedChange={(v) => setIsMinor(v === true)} />
          Es menor de edad (la sesión dura 30 min y usa la tarifa de menor)
        </label>

        {isMinor ? (
          <>
            <div className="space-y-1.5">
              <label htmlFor="cu-nacimiento" className="text-sm font-medium text-foreground">
                Fecha de nacimiento
              </label>
              <WheelDatePicker
                id="cu-nacimiento"
                value={birthDate}
                onChange={setBirthDate}
                defaultYear={new Date().getFullYear() - 10}
                fromYear={new Date().getFullYear() - 18}
                toYear={new Date().getFullYear()}
                invalid={Boolean(errores.birthDate)}
              />
              {ayuda("birthDate")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cu-tutor" className="text-sm font-medium text-foreground">
                Nombre del tutor
              </label>
              <Input id="cu-tutor" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} autoComplete="off" aria-invalid={Boolean(errores.guardianName)} />
              {ayuda("guardianName")}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="cu-tutor-tel" className="text-sm font-medium text-foreground">
                Teléfono del tutor
              </label>
              <TelefonoInput id="cu-tutor-tel" value={guardianPhone} onChange={setGuardianPhone} placeholder="311-123-4567" aria-invalid={Boolean(errores.guardianPhone)} />
              {ayuda("guardianPhone", "Recibe los recordatorios por WhatsApp.")}
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="cu-telefono" className="text-sm font-medium text-foreground">
              Teléfono
            </label>
            <TelefonoInput id="cu-telefono" value={phone} onChange={setPhone} placeholder="311-123-4567" aria-invalid={Boolean(errores.phone)} />
            {ayuda("phone", "Recibe los recordatorios por WhatsApp.")}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="cu-correo" className="text-sm font-medium text-foreground">
            Correo <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <Input id="cu-correo" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" aria-invalid={Boolean(errores.email)} />
          {ayuda("email", "Si lo das, también recibe los avisos por correo.")}
        </div>
      </div>

      {existente && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-foreground">
          <span>Este teléfono ya es de {existente.name}.</span>
          <Button type="button" size="sm" variant="outline" onClick={() => onExistente(existente)}>
            Agendar a {existente.name.split(" ")[0]}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" disabled={guardando} onClick={onCancelar}>
          Buscar paciente registrado
        </Button>
        <Button type="button" disabled={guardando} aria-busy={guardando} onClick={() => void enviar()}>
          {guardando ? <Loader2 className="animate-spin" /> : <UserPlus />}
          Usar estos datos
        </Button>
      </div>
    </div>
  )
}
