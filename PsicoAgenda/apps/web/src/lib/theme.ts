export type ThemePreference = "light" | "dark" | "system"

export const THEME_STORAGE_KEY = "psicoagenda-theme"

export function resolveSystemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function applyTheme(theme: ThemePreference): void {
  if (typeof document === "undefined") return
  const isDark = theme === "dark" || (theme === "system" && resolveSystemPrefersDark())
  document.documentElement.classList.toggle("dark", isDark)
}

export function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system"
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system"
}

export function storeTheme(theme: ThemePreference): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
}

/** Inyectado como script inline antes de la hidratación para evitar destello de tema incorrecto. */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var isDark = stored === "dark" || ((!stored || stored === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`
