"use client"

import { useState } from "react"
import { applyTheme, readStoredTheme, storeTheme, type ThemePreference } from "./theme"

/** Lee y aplica la preferencia de tema (claro/oscuro/sistema), persistiéndola en localStorage. */
export function useThemePreference() {
  const [theme, setThemeState] = useState<ThemePreference>(() => readStoredTheme())

  const setTheme = (next: ThemePreference) => {
    setThemeState(next)
    storeTheme(next)
    applyTheme(next)
  }

  return { theme, setTheme }
}
