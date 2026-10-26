"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Eye, EyeOff, Lock } from "lucide-react"
import { Input } from "@/components/motion/input"
import { passwordStrength } from "@/components/motion/signup-form"
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease"
import { cn } from "@/lib/utils"

const LABELS = ["Muy corta", "Débil", "Regular", "Buena", "Fuerte"] as const
const COLORS = ["bg-destructive", "bg-destructive", "bg-amber-500", "bg-amber-400", "bg-primary"] as const

// Lo mismo que exige passwordSchema (@psicoagenda/shared), para decir qué falta.
const MISSING: { test: (p: string) => boolean; hint: string }[] = [
  { test: (p) => /[A-Z]/.test(p), hint: "una mayúscula" },
  { test: (p) => /[a-z]/.test(p), hint: "una minúscula" },
  { test: (p) => /[0-9]/.test(p), hint: "un número" },
]

/**
 * Puntaje 0-4 del medidor de beui (pesa sobre todo la longitud), pero una
 * contraseña que el formulario rechazaría nunca pasa de "Débil".
 */
export function scorePassword(password: string): { score: number; missing: string[] } {
  const missing = MISSING.filter((rule) => !rule.test(password)).map((rule) => rule.hint)
  const base = passwordStrength(password)
  return { score: missing.length > 0 ? Math.min(base, 1) : base, missing }
}

/** Medidor animado (4 barras + texto). Se muestra solo cuando hay algo escrito. */
export function PasswordMeter({ value, className }: { value: string; className?: string }) {
  const reduce = useReducedMotion()
  const { score, missing } = scorePassword(value)
  const hint =
    value.length < 8
      ? 8 - value.length === 1
        ? "falta 1 carácter"
        : `faltan ${8 - value.length} caracteres`
      : missing.length > 0
        ? `falta ${missing.join(", ")}`
        : null

  return (
    <AnimatePresence initial={false}>
      {value.length > 0 ? (
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
          className={cn("flex flex-col gap-1.5 px-1", className)}
        >
          <div className="flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((index) => (
              <span key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-muted-foreground/20">
                <motion.span
                  initial={false}
                  animate={{ scaleX: index < score ? 1 : 0 }}
                  transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
                  className={cn("block h-full w-full origin-left rounded-full", COLORS[score])}
                />
              </span>
            ))}
          </div>
          <p aria-live="polite" className="text-xs text-muted-foreground">
            Seguridad: <span className="font-medium text-foreground">{LABELS[score]}</span>
            {hint && <span> · {hint}</span>}
          </p>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/**
 * Campo de contraseña nueva del formulario de registro de beui: candado, ojo
 * para mostrarla y medidor de seguridad animado debajo. Se usa en el registro
 * y en "Crear nueva contraseña" de recuperar cuenta.
 */
export function NewPasswordInput({
  id,
  name,
  label = "Contraseña",
  value,
  onChange,
  onBlur,
  error,
  revealed,
  onRevealedChange,
  disabled,
  autoFocus,
  placeholder = "Crea tu contraseña",
  inputRef,
  showMeter = true,
}: {
  id: string
  name?: string
  label?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  revealed: boolean
  onRevealedChange: (revealed: boolean) => void
  disabled?: boolean
  autoFocus?: boolean
  placeholder?: string
  inputRef?: React.Ref<HTMLInputElement>
  /** false: el medidor se pinta aparte con <PasswordMeter /> (p. ej. bajo dos columnas). */
  showMeter?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <Input
        ref={inputRef}
        id={id}
        name={name}
        label={label}
        type={revealed ? "text" : "password"}
        autoComplete="new-password"
        autoFocus={autoFocus}
        placeholder={placeholder}
        leftIcon={<Lock />}
        rightIcon={
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRevealedChange(!revealed)}
            aria-label={revealed ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={revealed}
            className="text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            {revealed ? <EyeOff /> : <Eye />}
          </button>
        }
        disabled={disabled}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
      />

      {showMeter && <PasswordMeter value={value} />}
    </div>
  )
}
