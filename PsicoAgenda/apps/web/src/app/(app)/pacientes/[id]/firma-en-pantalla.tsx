"use client"

import * as React from "react"
import { Eraser } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Firma dibujada con el dedo, el lápiz o el mouse. Entrega un PNG (data URL) cada
 * vez que se levanta el trazo, o `null` si se borra.
 */
export function FirmaEnPantalla({ onChange, id }: { onChange: (png: string | null) => void; id?: string }) {
  const lienzo = React.useRef<HTMLCanvasElement>(null)
  const dibujando = React.useRef(false)
  const [vacia, setVacia] = React.useState(true)

  // Resolución real del lienzo según su tamaño en pantalla y la densidad de pixeles.
  React.useEffect(() => {
    const c = lienzo.current
    if (!c) return
    const escala = window.devicePixelRatio || 1
    const { width, height } = c.getBoundingClientRect()
    c.width = Math.round(width * escala)
    c.height = Math.round(height * escala)
    const ctx = c.getContext("2d")
    if (!ctx) return
    ctx.scale(escala, escala)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#111827"
  }, [])

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = e.currentTarget.getContext("2d")
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dibujando.current = true
    const { x, y } = punto(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
  }

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dibujando.current) return
    const ctx = e.currentTarget.getContext("2d")
    if (!ctx) return
    const { x, y } = punto(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const terminar = () => {
    if (!dibujando.current) return
    dibujando.current = false
    setVacia(false)
    onChange(lienzo.current?.toDataURL("image/png") ?? null)
  }

  const borrar = () => {
    const c = lienzo.current
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height)
    setVacia(true)
    onChange(null)
  }

  return (
    <div className="space-y-1.5">
      <div className="relative">
        {/* Fondo blanco fijo: la firma se guarda como PNG con trazo oscuro, igual en tema claro y oscuro. */}
        <canvas
          ref={lienzo}
          id={id}
          aria-label="Área para firmar"
          className="h-36 w-full touch-none rounded-xl border border-input bg-white"
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
        />
        {vacia && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-gray-400">
            Firma aquí
          </span>
        )}
      </div>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={borrar} disabled={vacia}>
          <Eraser className="size-3.5" />
          Borrar firma
        </Button>
      </div>
    </div>
  )
}
