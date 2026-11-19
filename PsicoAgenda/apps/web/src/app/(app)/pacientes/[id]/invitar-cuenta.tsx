"use client"

import * as React from "react"
import { Check, Copy, Loader2, MessageCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { patientService } from "@/services"

/**
 * Invita a un paciente de cita única a crear su cuenta. El enlace lo liga a su
 * ficha: al registrarse conserva su valoración, bitácora y cobros.
 */
export function InvitarCuenta({ pacienteId, nombre, telefono }: { pacienteId: string; nombre: string; telefono?: string }) {
  const [abierto, setAbierto] = React.useState(false)
  const [cargando, setCargando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [invitacion, setInvitacion] = React.useState<{ enlace: string; enviadoPorCorreo: boolean } | null>(null)
  const [copiado, setCopiado] = React.useState(false)

  const generar = async () => {
    setAbierto(true)
    setCargando(true)
    setError(null)
    setCopiado(false)
    try {
      setInvitacion(await patientService.invite(pacienteId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar la invitación.")
    } finally {
      setCargando(false)
    }
  }

  const copiar = async () => {
    if (!invitacion) return
    try {
      await navigator.clipboard.writeText(invitacion.enlace)
      setCopiado(true)
    } catch {
      setError("No se pudo copiar. Selecciona el enlace y cópialo a mano.")
    }
  }

  const digitos = telefono?.replace(/\D/g, "") ?? ""
  const whatsapp =
    invitacion && digitos.length >= 10
      ? `https://wa.me/${digitos.length === 10 ? `52${digitos}` : digitos}?text=${encodeURIComponent(
          `Hola, ${nombre.split(" ")[0]}. Para seguir agendando tus citas, crea tu cuenta aquí (tu historial se conserva): ${invitacion.enlace}`,
        )}`
      : null

  return (
    <>
      <Button type="button" variant="outline" className="h-10 rounded-xl px-4 text-xs font-semibold" onClick={() => void generar()}>
        <Send className="size-4" />
        Invitar a crear cuenta
      </Button>
      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar a {nombre} a crear su cuenta</DialogTitle>
            <DialogDescription>
              Al registrarse con este enlace conserva su valoración, bitácora y cobros. Vale 7 días.
            </DialogDescription>
          </DialogHeader>

          {cargando ? (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Generando el enlace…
            </p>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : invitacion ? (
            <div className="space-y-3">
              {invitacion.enviadoPorCorreo && (
                <p className="rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
                  Ya le enviamos el enlace a su correo.
                </p>
              )}
              <label htmlFor="enlace-invitacion" className="text-sm font-medium text-foreground">
                Enlace de registro
              </label>
              <input
                id="enlace-invitacion"
                readOnly
                value={invitacion.enlace}
                onFocus={(e) => e.currentTarget.select()}
                className="h-10 w-full rounded-lg border border-input bg-muted/30 px-3 text-xs text-foreground"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => void copiar()}>
                  {copiado ? <Check /> : <Copy />}
                  {copiado ? "Copiado" : "Copiar enlace"}
                </Button>
                {whatsapp && (
                  <Button asChild>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                      <MessageCircle />
                      Enviar por WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
