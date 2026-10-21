"use client"

import { useCallback, useSyncExternalStore } from "react"
import {
  applyTheme,
  readPreferences,
  writePreferences,
  THEME_MODE_VALUES,
  THEME_PALETTE_VALUES,
  type ThemeMode,
  type ThemePalette,
} from "./theme"

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  const handleStorage = () => {
    applyTheme(readPreferences())
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

// Cada snapshot devuelve un primitivo para que `useSyncExternalStore` no entre
// en bucles por objetos nuevos en cada lectura.
const leerModo = () => readPreferences().mode
const leerPaleta = () => readPreferences().palette
const modoServidor = () => "system" as ThemeMode
const paletaServidor = () => "default" as ThemePalette

/**
 * Preferencias de tema separadas en dos decisiones independientes: el modo de
 * luminosidad (claro/oscuro/automático) y la paleta de color. Ambas se
 * persisten y se aplican al DOM.
 */
export function useThemePreference() {
  const mode = useSyncExternalStore(subscribe, leerModo, modoServidor)
  const palette = useSyncExternalStore(subscribe, leerPaleta, paletaServidor)

  const setMode = useCallback((next: ThemeMode) => {
    // Se ignoran valores fuera del catálogo (p. ej. un control que emite "").
    if (!THEME_MODE_VALUES.includes(next)) return
    const actual = { ...readPreferences(), mode: next }
    writePreferences(actual)
    applyTheme(actual)
    notify()
  }, [])

  const setPalette = useCallback((next: ThemePalette) => {
    if (!THEME_PALETTE_VALUES.includes(next)) return
    const actual = { ...readPreferences(), palette: next }
    writePreferences(actual)
    applyTheme(actual)
    notify()
  }, [])

  /** Vuelve al tema de la marca: automático + paleta por defecto. */
  const reset = useCallback(() => {
    const prefs = { mode: "system" as const, palette: "default" as const }
    writePreferences(prefs)
    applyTheme(prefs)
    notify()
  }, [])

  return { mode, palette, setMode, setPalette, reset }
}
