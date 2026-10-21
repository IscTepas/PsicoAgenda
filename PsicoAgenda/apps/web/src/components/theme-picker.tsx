"use client";

import { useEffect, useState } from "react";
import { Check, Contrast, Monitor, Moon, RotateCcw, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  resolveIsDark,
  THEME_ACCESSIBILITY,
  THEME_MODES,
  THEME_PALETTES,
  type ThemeMode,
  type ThemePalette,
} from "@/lib/theme";

const ICONOS = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Selector de tema en dos decisiones independientes:
 * - modo (claro/oscuro/automático) como control segmentado con el activo resaltado;
 * - paleta como tarjetas con muestras, y "Alto contraste" aparte por accesibilidad.
 *
 * Las muestras se pintan con las variables del propio tema (`data-theme` +
 * `dark` en el contenedor), así no se duplican colores en el componente.
 */
export function ThemePicker({
  mode,
  palette,
  onModeChange,
  onPaletteChange,
  onReset,
}: {
  mode: ThemeMode;
  palette: ThemePalette;
  onModeChange: (mode: ThemeMode) => void;
  onPaletteChange: (palette: ThemePalette) => void;
  onReset: () => void;
}) {
  // Se resuelve en el cliente para previsualizar cada paleta tal como se verá,
  // sin desajustes de hidratación.
  const [esOscuro, setEsOscuro] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const actualizar = () => setEsOscuro(resolveIsDark(mode, mq.matches));
    actualizar();
    mq.addEventListener("change", actualizar);
    return () => mq.removeEventListener("change", actualizar);
  }, [mode]);

  const yaEsPredeterminado = mode === "system" && palette === "default";

  return (
    <div className="space-y-3">
      {/* Modo: un solo contenedor, activo con fondo primario */}
      <div
        role="group"
        aria-label="Modo de luminosidad"
        className="inline-flex w-full rounded-xl border border-border/70 bg-muted/40 p-1"
      >
        {THEME_MODES.map((opcion) => {
          const Icono = ICONOS[opcion.value];
          const activo = mode === opcion.value;

          return (
            <button
              key={opcion.value}
              type="button"
              onClick={() => onModeChange(opcion.value)}
              aria-pressed={activo}
              className={cn(
                "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-all",
                activo
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
              )}
            >
              <Icono className="size-3.5" />
              {opcion.label}
            </button>
          );
        })}
      </div>

      {/* Paletas estéticas: 3×2 exacta */}
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        role="group"
        aria-label="Paletas de color"
      >
        {THEME_PALETTES.map((opcion) => {
          const activo = palette === opcion.value;

          return (
            <button
              key={opcion.value}
              type="button"
              onClick={() => onPaletteChange(opcion.value)}
              aria-pressed={activo}
              className={cn(
                "relative rounded-xl border p-2.5 text-left transition-all",
                activo
                  ? "border-primary bg-primary/5 ring-2 ring-primary/25"
                  : "border-border/70 hover:border-border hover:bg-muted/50"
              )}
            >
              <div
                data-theme={opcion.value}
                className={cn("flex gap-1.5", esOscuro && "dark")}
                aria-hidden="true"
              >
                <span
                  className="size-5 rounded-md border border-border/60"
                  style={{ background: "var(--background)" }}
                />
                <span className="size-5 rounded-md" style={{ background: "var(--primary)" }} />
                <span className="size-5 rounded-md" style={{ background: "var(--accent)" }} />
              </div>
              <span className="mt-2 block text-xs font-medium text-foreground">
                {opcion.label}
              </span>
              {activo ? <Check className="absolute right-2 top-2 size-3.5 text-primary" /> : null}
            </button>
          );
        })}
      </div>

      {/* Accesibilidad: separada del resto y con el restablecer al lado */}
      <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => onPaletteChange(THEME_ACCESSIBILITY.value)}
          aria-pressed={palette === THEME_ACCESSIBILITY.value}
          className={cn(
            "flex flex-1 items-center gap-2 rounded-xl border p-2.5 text-left transition-all",
            palette === THEME_ACCESSIBILITY.value
              ? "border-primary bg-primary/5 ring-2 ring-primary/25"
              : "border-border/70 hover:border-border hover:bg-muted/50"
          )}
        >
          <Contrast className="size-4 shrink-0 text-primary" />
          <span className="text-xs font-medium text-foreground">{THEME_ACCESSIBILITY.label}</span>
          <span className="text-[10px] text-muted-foreground">Accesibilidad</span>
          {palette === THEME_ACCESSIBILITY.value ? (
            <Check className="ml-auto size-3.5 text-primary" />
          ) : null}
        </button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          disabled={yaEsPredeterminado}
          title="Volver al tema de la marca (automático)"
          className="h-9 shrink-0 rounded-xl text-xs"
        >
          <RotateCcw className="mr-1.5 size-3.5" />
          Restablecer
        </Button>
      </div>
    </div>
  );
}
