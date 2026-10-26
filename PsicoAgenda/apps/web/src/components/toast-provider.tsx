"use client"

import * as React from "react"
import {
  AnimatedToastStack,
  useAnimatedToastStack,
  type ToastInput,
} from "@/components/motion/animated-toast-stack"

type ToastApi = {
  /** Muestra un aviso y devuelve su id (para actualizarlo, p. ej. de "cargando" a "listo"). */
  toast: (input: ToastInput) => string
  updateToast: (id: string, patch: Partial<ToastInput>) => void
  dismissToast: (id: string) => void
}

const ToastContext = React.createContext<ToastApi | null>(null)

/**
 * Avisos flotantes de toda la app (abajo a la derecha). Vive en el shell, así un
 * aviso lanzado antes de navegar sigue visible en la pantalla siguiente.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, showToast, updateToast, dismissToast } = useAnimatedToastStack({ limit: 5 })
  const api = React.useMemo(
    () => ({ toast: showToast, updateToast, dismissToast }),
    [showToast, updateToast, dismissToast],
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <AnimatedToastStack
        toasts={toasts}
        onDismiss={dismissToast}
        position="bottom-right"
        placement="fixed"
        maxVisible={3}
        // En móvil se levanta por encima de la barra inferior.
        className="bottom-24 md:bottom-6"
      />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>")
  return ctx
}
