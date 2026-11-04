"use client";

import { useEffect, useState } from "react";
import { Check, Contrast, Monitor, Moon, Sun } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { Switch } from "@/components/ui/switch";
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
 * - paleta como tarjetas con muestras (la primera, "Original", es la de la marca);
 * - "Alto contraste" aparte, como interruptor de accesibilidad.
 *
 * Las muestras se pintan con las variables del propio tema (`data-theme` +
 * `dark` en el contenedor), así no se duplican colores en el componente.
 */
export function ThemePicker({
  mode,
  palette,
  onModeChange,
  onPaletteChange,
  onContrastChange,
}: {
  mode: ThemeMode;
  palette: ThemePalette;
  onModeChange: (mode: ThemeMode) => void;
  onPaletteChange: (palette: ThemePalette) => void;
  /** Apagarlo devuelve a una paleta estética; cuál, lo decide quien usa el selector. */
  onContrastChange: (on: boolean) => void;
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

  const contraste = palette === THEME_ACCESSIBILITY.value;

  return (
    <div className="space-y-3">
      {/* Modo: control segmentado; el indicador primario se desliza a la opción activa */}
      <Tabs value={mode} onValueChange={(next) => onModeChange(next as ThemeMode)} variant="segment">
        <TabsList
          aria-label="Modo de luminosidad"
          className="w-full rounded-xl border border-border/70 bg-muted/40 p-1 [&>div]:flex-1"
        >
          {THEME_MODES.map((opcion) => {
            const Icono = ICONOS[opcion.value];
            return (
              <TabsTrigger
                key={opcion.value}
                value={opcion.value}
                icon={<Icono className="size-3.5" />}
                className="h-8 w-full text-xs"
              >
                {opcion.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Paletas estéticas: Original + seis */}
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
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

      {/* Accesibilidad: un interruptor aparte de las paletas */}
      <label className="flex cursor-pointer items-center gap-2 border-t border-border/60 pt-3">
        <Contrast className="size-4 shrink-0 text-primary" />
        <span className="text-xs font-medium text-foreground">{THEME_ACCESSIBILITY.label}</span>
        <span className="text-[10px] text-muted-foreground">Accesibilidad</span>
        <Switch
          className="ml-auto"
          checked={contraste}
          onCheckedChange={onContrastChange}
          aria-label={`${contraste ? "Desactivar" : "Activar"} ${THEME_ACCESSIBILITY.label.toLowerCase()}`}
        />
      </label>
    </div>
  );
}
