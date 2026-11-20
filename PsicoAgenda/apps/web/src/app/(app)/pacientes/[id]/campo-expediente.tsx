"use client"

import * as React from "react"
import { Edit3, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/**
 * Un apartado del expediente: se lee y, con «Editar», se escribe ahí mismo.
 * Con `bloqueado` (historia cerrada) ya no se edita.
 */
export function CampoDelExpediente({
  titulo,
  ayuda,
  valor,
  vacio,
  max,
  filas = 4,
  bloqueado = false,
  obligatorio = false,
  onGuardar,
}: {
  titulo: string
  ayuda?: string
  valor?: string
  vacio: string
  max: number
  filas?: number
  bloqueado?: boolean
  /** Hace falta para cerrar la historia: se marca aquí mismo mientras esté vacío. */
  obligatorio?: boolean
  onGuardar: (valor: string) => Promise<void>
}) {
  const [editando, setEditando] = React.useState(false)
  const [texto, setTexto] = React.useState(valor ?? "")
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const id = React.useId()

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await onGuardar(texto.trim())
      setEditando(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 id={id} className="text-sm font-semibold text-foreground">
            {titulo}
            {obligatorio && (
              <span className="text-destructive" aria-hidden="true">
                {" "}*
              </span>
            )}
          </h4>
          {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
        </div>
        {!editando && !bloqueado && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() => {
              setTexto(valor ?? "")
              setEditando(true)
            }}
          >
            <Edit3 className="size-3.5" />
            Editar
          </Button>
        )}
      </div>
      {editando ? (
        <div className="space-y-2">
          <Textarea
            aria-labelledby={id}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={filas}
            maxLength={max}
            autoFocus
            disabled={guardando}
            className="rounded-xl text-sm"
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={guardando} onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={guardando} aria-busy={guardando} onClick={() => void guardar()}>
              {guardando && <Loader2 className="size-3.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      ) : obligatorio && !valor && !bloqueado ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3.5 text-sm text-destructive">
          Obligatorio para cerrar la historia clínica.
        </p>
      ) : (
        <p
          className={`whitespace-pre-line rounded-xl bg-muted/20 p-3.5 text-sm leading-relaxed ${valor ? "text-foreground" : "text-muted-foreground"}`}
        >
          {valor || vacio}
        </p>
      )}
    </section>
  )
}
