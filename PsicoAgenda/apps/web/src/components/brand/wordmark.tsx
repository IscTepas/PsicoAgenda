import { cn } from "@/lib/utils"

/**
 * La palabra "PsicoAgenda" con los colores del logo original: "Psico" en azul
 * marino y "Agenda" en verde. Úsala junto al ícono en lugar del texto plano.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-bold tracking-tight", className)}>
      <span className="text-brand-psico">Psico</span>
      <span className="text-brand-agenda">Agenda</span>
    </span>
  )
}
