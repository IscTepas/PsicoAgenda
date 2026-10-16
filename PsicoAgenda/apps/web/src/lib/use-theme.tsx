"use client"

import { useCallback, useSyncExternalStore } from "react"
import { applyTheme, readStoredTheme, storeTheme, type ThemePreference } from "./theme"

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  const handleStorage = () => {
    applyTheme(readStoredTheme())
    listener()
  }
  listeners.add(listener)
  window.addEventListener("storage", handleStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", handleStorage)
  }
}

function notify() {
  listeners.forEach((listener) => listener())
}

/**
 * Lee y aplica la preferencia de tema (claro/oscuro/sistema), persistiéndola en localStorage.
 * El primer render es "system" (igual en servidor y cliente) y el valor persistido se
 * sincroniza tras montar vía useSyncExternalStore, evitando el hydration mismatch por leer
 * localStorage en render y sin disparar renders en cascada desde un effect.
 */
export function useThemePreference() {
  const theme = useSyncExternalStore(
    subscribe,
    readStoredTheme,
    () => "system" as ThemePreference
  )

  const setTheme = useCallback((next: ThemePreference) => {
    storeTheme(next)
    applyTheme(next)
    notify()
  }, [])

  return { theme, setTheme }
}
