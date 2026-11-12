"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select"

const OTRO = "Otro"

export const PARENTESCOS_TUTOR = ["Madre", "Padre", "Abuela o abuelo", "Tía o tío", "Hermana o hermano mayor", "Tutor legal"]
export const PARENTESCOS_CONTACTO = ["Pareja", "Madre", "Padre", "Hermana o hermano", "Hija o hijo", "Amistad"]

/** Lista de opciones comunes más «Otro» (parentescos, motivos…): los más comunes en una lista y «Otro» para escribirlo. El valor es siempre el texto final. */
export function ParentescoSelect({
  value,
  onChange,
  opciones,
  placeholder = "Elige el parentesco",
  ariaLabel = "Parentesco",
  otroPlaceholder = "Escribe el parentesco",
  disabled,
  invalid,
  maxLength = 40,
}: {
  maxLength?: number
  value: string
  onChange: (value: string) => void
  opciones: string[]
  placeholder?: string
  ariaLabel?: string
  otroPlaceholder?: string
  disabled?: boolean
  invalid?: boolean
}) {
  // Un valor guardado que no está en la lista se trata como «Otro».
  const [otro, setOtro] = React.useState(() => value !== "" && !opciones.includes(value))

  return (
    <div className="space-y-2">
      <Select
        value={otro ? OTRO : value || undefined}
        onValueChange={(elegido) => {
          setOtro(elegido === OTRO)
          onChange(elegido === OTRO ? "" : elegido)
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" aria-label={ariaLabel} aria-invalid={invalid || undefined}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((opcion) => (
            <SelectItem key={opcion} value={opcion}>
              {opcion}
            </SelectItem>
          ))}
          <SelectItem value={OTRO}>Otro</SelectItem>
        </SelectContent>
      </Select>
      {otro && (
        <Input
          autoFocus
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={maxLength}
          placeholder={otroPlaceholder}
          aria-label={`${ariaLabel} (otro)`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
        />
      )}
    </div>
  )
}
