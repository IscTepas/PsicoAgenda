export type ThemeMode = "light" | "dark" | "system"

/** Paleta con nombre; `default` es el teal de la marca. */
export type ThemePalette =
  | "default"
  | "oceano"
  | "bosque"
  | "atardecer"
  | "lavanda"
  | "cereza"
  | "sepia"
  | "contraste"

/** Paletas elegibles (todo menos la de marca). */
export type ThemePaletteChoice = Exclude<ThemePalette, "default">

export interface ThemePreferences {
  mode: ThemeMode;
  palette: ThemePalette;
}

/** Clave del modo. Se conserva el nombre anterior para migrar sin perderlo. */
export const THEME_MODE_KEY = "psicoagenda-theme";
export const THEME_PALETTE_KEY = "psicoagenda-palette";

export const THEME_MODE_VALUES = ["light", "dark", "system"] as const;
export const THEME_PALETTE_VALUES = [
  "default",
  "oceano",
  "bosque",
  "atardecer",
  "lavanda",
  "cereza",
  "sepia",
  "contraste",
] as const;
export const THEME_PALETTE_CHOICES = [
  "oceano",
  "bosque",
  "atardecer",
  "lavanda",
  "cereza",
  "sepia",
  "contraste",
] as const;

/** Modos de luminosidad; el selector los muestra como control segmentado. */
export const THEME_MODES: ReadonlyArray<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
  { value: "system", label: "Automático" },
];

/** Paletas estéticas; `Alto contraste` va aparte por ser accesibilidad. */
export const THEME_PALETTES: ReadonlyArray<{
  value: Exclude<ThemePaletteChoice, "contraste">;
  label: string;
}> = [
  { value: "oceano", label: "Océano" },
  { value: "bosque", label: "Bosque" },
  { value: "atardecer", label: "Atardecer" },
  { value: "lavanda", label: "Lavanda" },
  { value: "cereza", label: "Cereza" },
  { value: "sepia", label: "Sepia" },
];

export const THEME_ACCESSIBILITY: { value: "contraste"; label: string } = {
  value: "contraste",
  label: "Alto contraste",
};

export function resolveSystemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Modo oscuro efectivo, independiente de la paleta. */
export function resolveIsDark(mode: ThemeMode, systemPrefersDark: boolean): boolean {
  if (mode === "dark") return true;
  if (mode === "light") return false;
  return systemPrefersDark;
}

/**
 * Traduce las preferencias a lo que hay que pintar: si el modo es oscuro y qué
 * `data-theme` aplicar. Función pura para poder probarla sin DOM.
 */
export function resolveTheme(
  prefs: ThemePreferences,
  systemPrefersDark: boolean
): { isDark: boolean; dataTheme: ThemePaletteChoice | null } {
  return {
    isDark: resolveIsDark(prefs.mode, systemPrefersDark),
    dataTheme: prefs.palette === "default" ? null : prefs.palette,
  };
}

export function applyTheme(prefs: ThemePreferences): void {
  if (typeof document === "undefined") return;
  const { isDark, dataTheme } = resolveTheme(prefs, resolveSystemPrefersDark());
  const root = document.documentElement;
  root.classList.toggle("dark", isDark);
  if (dataTheme) root.setAttribute("data-theme", dataTheme);
  else root.removeAttribute("data-theme");
}

/**
 * Lee las preferencias guardadas. Si encuentra el formato anterior (un único
 * valor combinado en `psicoagenda-theme`), lo migra en memoria a modo + paleta.
 */
export function readPreferences(): ThemePreferences {
  if (typeof window === "undefined") return { mode: "system", palette: "default" };

  const storedMode = window.localStorage.getItem(THEME_MODE_KEY);
  const storedPalette = window.localStorage.getItem(THEME_PALETTE_KEY);

  if (!storedPalette && THEME_PALETTE_CHOICES.includes(storedMode as ThemePaletteChoice)) {
    return { mode: "system", palette: storedMode as ThemePaletteChoice };
  }

  return {
    mode: THEME_MODE_VALUES.includes(storedMode as ThemeMode)
      ? (storedMode as ThemeMode)
      : "system",
    palette: THEME_PALETTE_VALUES.includes(storedPalette as ThemePalette)
      ? (storedPalette as ThemePalette)
      : "default",
  };
}

export function writePreferences(prefs: ThemePreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_MODE_KEY, prefs.mode);
  window.localStorage.setItem(THEME_PALETTE_KEY, prefs.palette);
}

/** Inyectado como script inline antes de la hidratación para evitar destello de tema incorrecto. */
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var modeKey = "${THEME_MODE_KEY}";
    var paletteKey = "${THEME_PALETTE_KEY}";
    var storedMode = localStorage.getItem(modeKey);
    var storedPalette = localStorage.getItem(paletteKey);
    var choices = ["oceano","bosque","atardecer","lavanda","cereza","sepia","contraste"];
    var mode;
    var palette;
    if (!storedPalette && storedMode && choices.indexOf(storedMode) >= 0) {
      mode = "system";
      palette = storedMode;
      localStorage.setItem(modeKey, mode);
      localStorage.setItem(paletteKey, palette);
    } else {
      mode = storedMode === "light" || storedMode === "dark" || storedMode === "system" ? storedMode : "system";
      palette = storedPalette && choices.indexOf(storedPalette) >= 0 ? storedPalette : "default";
    }
    var isDark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) document.documentElement.classList.add("dark");
    if (palette !== "default") document.documentElement.setAttribute("data-theme", palette);
  } catch (e) {}
})();
`;
