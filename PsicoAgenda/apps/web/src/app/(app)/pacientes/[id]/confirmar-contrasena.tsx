"use client"

import * as React from "react"
import { Loader2, Lock } from "lucide-react"
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

/**
 * Confirmación con contraseña antes de sellar algo del expediente (nota, historia
 * clínica o nota aclaratoria). Con `conTexto` pide también la aclaración.
 */
export function ConfirmarConContrasena({
  open,
  onOpenChange,
  titulo,
  descripcion,
  accion,
  conTexto = false,
  onConfirmar,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  titulo: string
  descripcion: string
  accion: string
  conTexto?: boolean
  onConfirmar: (password: string, texto: string) => Promise<void>
}) {
  const [password, setPassword] = React.useState("")
  const [texto, setTexto] = React.useState("")
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const id = React.useId()

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      await onConfirmar(password, texto.trim())
      setPassword("")
      setTexto("")
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo completar.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !guardando && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => void enviar(e)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription>{descripcion}</DialogDescription>
          </DialogHeader>
          {conTexto && (
            <div className="space-y-1.5">
              <Label htmlFor={`${id}-texto`}>Aclaración</Label>
              <Textarea
                id={`${id}-texto`}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                maxLength={5000}
                required
                minLength={3}
                placeholder="Qué se corrige y por qué. La nota original no cambia."
                className="rounded-xl"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`${id}-pass`}>Tu contraseña</Label>
            <Input
              id={`${id}-pass`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus={!conTexto}
              className="h-10 rounded-xl"
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
            <Button type="submit" disabled={guardando || !password || (conTexto && texto.trim().length < 3)} aria-busy={guardando}>
              {guardando ? <Loader2 className="animate-spin" /> : <Lock />}
              {accion}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
