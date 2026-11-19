"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ExternalLink, Loader2, Video } from "lucide-react"
import { updatePsychologistProfileSchema } from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/toast-provider"
import { psychologistService } from "@/services"

const CLAVE = ["psicologo", "yo"]

/** El enlace fijo de la sala de videollamada: lo usan ella y sus pacientes en las sesiones en línea. */
export function EnlaceVideollamada() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: perfil } = useQuery({ queryKey: CLAVE, queryFn: () => psychologistService.getMe() })
  const guardado = perfil?.videoCallUrl ?? ""
  const [borrador, setBorrador] = useState<string | null>(null)
  const valor = borrador ?? guardado
  const [error, setError] = useState<string | null>(null)

  const guardar = useMutation({
    mutationFn: (videoCallUrl: string) => psychologistService.updateMe({ videoCallUrl }),
    onSuccess: (actualizado) => {
      queryClient.setQueryData(CLAVE, actualizado)
      setBorrador(null)
      toast({ title: actualizado.videoCallUrl ? "Enlace guardado" : "Enlace quitado", status: "success" })
    },
    onError: (err) => setError(err instanceof Error ? err.message : "No se pudo guardar el enlace."),
  })

  const enviar = (event: React.FormEvent) => {
    event.preventDefault()
    const revisado = updatePsychologistProfileSchema.shape.videoCallUrl.safeParse(valor.trim())
    if (!revisado.success) {
      setError(revisado.error.issues[0]?.message ?? "Revisa el enlace.")
      return
    }
    setError(null)
    guardar.mutate(valor.trim())
  }

  return (
    <form onSubmit={enviar} className="max-w-2xl space-y-4 rounded-2xl border border-border/60 bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Video className="size-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">Tu sala de videollamada</h2>
          <p className="text-sm text-muted-foreground">
            Pega el enlace fijo de tu sala (Google Meet, Zoom…). Tus pacientes lo verán en sus citas en línea y tú
            entrarás con un toque al atenderlas.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enlace-videollamada">Enlace</Label>
        <Input
          id="enlace-videollamada"
          type="url"
          inputMode="url"
          placeholder="https://meet.google.com/abc-defg-hij"
          value={valor}
          onChange={(e) => {
            setBorrador(e.target.value)
            setError(null)
          }}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "enlace-error" : undefined}
          disabled={guardar.isPending}
        />
        {error && (
          <p id="enlace-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={guardar.isPending || valor.trim() === guardado} aria-busy={guardar.isPending}>
          {guardar.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Guardar
        </Button>
        {guardado && (
          <Button asChild variant="outline">
            <a href={guardado} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              Probar enlace
            </a>
          </Button>
        )}
      </div>
    </form>
  )
}
