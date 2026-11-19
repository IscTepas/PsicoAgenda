"use client"

import * as React from "react"
import { MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/**
 * Sugerencias de dirección con Photon (OpenStreetMap, komoot): gratis y sin clave,
 * hecho para autocompletar mientras se escribe (Nominatim lo prohíbe en su política).
 * Lo escrito viaja a photon.komoot.io; solo se consulta a partir de 4 letras.
 */
const PHOTON_URL = "https://photon.komoot.io/api/"
// Sesgo hacia el consultorio (Tepic) y recorte a México: las primeras sugerencias quedan cerca.
const CERCA = { lat: "21.5039", lon: "-104.8946" }
const MEXICO_BBOX = "-118.6,14.3,-86.5,32.8"
const MIN_LETRAS = 4
const ESPERA_MS = 350

interface PhotonFeature {
  properties: {
    name?: string
    street?: string
    housenumber?: string
    district?: string
    locality?: string
    city?: string
    county?: string
    state?: string
    postcode?: string
  }
}

/** "Av. Madero 153, Amado Nervo, Tepic, Nayarit, 63000" sin partes repetidas ni vacías. */
function textoDe({ properties: p }: PhotonFeature): string {
  const calle = p.street ? [p.street, p.housenumber].filter(Boolean).join(" ") : p.name
  const partes = [calle, p.district ?? p.locality, p.city ?? p.county, p.state, p.postcode]
  return [...new Set(partes.filter((parte): parte is string => Boolean(parte?.trim())))].join(", ")
}

export function DireccionAutocomplete({
  value,
  onChange,
  onBlur,
  id,
  invalid,
  placeholder = "Calle, número, colonia y ciudad",
  "aria-describedby": describedBy,
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  id?: string
  invalid?: boolean
  placeholder?: string
  "aria-describedby"?: string
}) {
  const listaId = React.useId()
  const [sugerencias, setSugerencias] = React.useState<string[]>([])
  const [abierta, setAbierta] = React.useState(false)
  const [activa, setActiva] = React.useState(-1)
  // Tras elegir una sugerencia no se vuelve a buscar lo que se acaba de escribir.
  const elegida = React.useRef<string | null>(null)

  React.useEffect(() => {
    const consulta = value.trim()
    if (consulta.length < MIN_LETRAS || consulta === elegida.current) {
      setSugerencias([])
      return
    }
    const control = new AbortController()
    const espera = setTimeout(() => {
      const params = new URLSearchParams({ q: consulta, limit: "5", bbox: MEXICO_BBOX, ...CERCA })
      fetch(`${PHOTON_URL}?${params}`, { signal: control.signal })
        .then((r) => (r.ok ? r.json() : { features: [] }))
        .then((data: { features?: PhotonFeature[] }) => {
          const textos = [...new Set((data.features ?? []).map(textoDe).filter(Boolean))]
          setSugerencias(textos)
          setActiva(-1)
          setAbierta(textos.length > 0)
        })
        // Sin red o con el servicio caído, el campo sigue funcionando como texto libre.
        .catch(() => undefined)
    }, ESPERA_MS)
    return () => {
      clearTimeout(espera)
      control.abort()
    }
  }, [value])

  const elegir = (texto: string) => {
    elegida.current = texto
    onChange(texto)
    setAbierta(false)
    setSugerencias([])
  }

  const visible = abierta && sugerencias.length > 0

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={visible}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={visible && activa >= 0 ? `${listaId}-${activa}` : undefined}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        autoComplete="street-address"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          elegida.current = null
          onChange(e.target.value)
        }}
        onFocus={() => setAbierta(sugerencias.length > 0)}
        onBlur={() => {
          // El clic en una sugerencia llega después del blur: se cierra con un respiro.
          setTimeout(() => setAbierta(false), 150)
          onBlur?.()
        }}
        onKeyDown={(e) => {
          if (!visible) return
          if (e.key === "ArrowDown") {
            e.preventDefault()
            setActiva((i) => (i + 1) % sugerencias.length)
          } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setActiva((i) => (i <= 0 ? sugerencias.length - 1 : i - 1))
          } else if (e.key === "Enter" && activa >= 0) {
            e.preventDefault()
            elegir(sugerencias[activa]!)
          } else if (e.key === "Escape") {
            setAbierta(false)
          }
        }}
      />
      {visible && (
        <ul
          id={listaId}
          role="listbox"
          aria-label="Direcciones sugeridas"
          className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg"
        >
          {sugerencias.map((texto, i) => (
            <li
              key={texto}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={i === activa}
              // mousedown en vez de click: se elige antes de que el input pierda el foco.
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(texto)
              }}
              className={cn(
                "flex cursor-pointer items-start gap-2 px-3 py-2.5 text-sm text-foreground",
                i === activa ? "bg-muted" : "hover:bg-muted/60",
              )}
            >
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0">{texto}</span>
            </li>
          ))}
          <li role="presentation" className="px-3 pb-1 pt-1.5 text-[11px] text-muted-foreground">
            Sugerencias de OpenStreetMap
          </li>
        </ul>
      )}
    </div>
  )
}
