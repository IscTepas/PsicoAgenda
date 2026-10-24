"use client";

import * as React from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";
import {
  addMonths,
  DIAS_SEMANA,
  monthGridSunday,
  monthLabel,
  startOfMonth,
  type EstadoDia,
} from "@/lib/calendario";
import { addDays, formatDateToInput, isSameDay, startOfDay } from "@/lib/citas";

interface MultiMonthCalendarProps {
  selected: Date | null;
  onSelect: (date: Date) => void;
  /** Cantidad de meses visibles. */
  months?: number;
  /** Días anteriores a esta fecha no se pueden elegir. */
  minDate?: Date | null;
  /** Días posteriores a esta fecha no se pueden elegir. */
  maxDate?: Date | null;
  /** Estado visual de cada día (disponible, con citas, lleno, sin horario). */
  dayStatus?: (date: Date) => EstadoDia;
  /** Se avisa el rango visible para pedir la ocupación de esos meses. */
  onVisibleRangeChange?: (from: Date, to: Date) => void;
  initialMonth?: Date;
  loading?: boolean;
  className?: string;
}

const ESTADO_DIA: Record<EstadoDia, { label: string; punto: string }> = {
  available: { label: "Disponible", punto: "bg-primary/40" },
  partial: { label: "Con citas", punto: "bg-chart-2" },
  full: { label: "Día completo", punto: "bg-amber-500" },
  "no-schedule": { label: "Sin horario", punto: "bg-muted-foreground/30" },
  disabled: { label: "No disponible", punto: "bg-muted-foreground/20" },
};

function mismoMes(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatearDiaLargo(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Calendario de varios meses en tarjetas. Reutiliza la cuadrícula propia del
 * proyecto (sin date-fns) y pinta cada día según la disponibilidad que recibe.
 */
export function MultiMonthCalendar({
  selected,
  onSelect,
  months = 4,
  minDate = null,
  maxDate = null,
  dayStatus,
  onVisibleRangeChange,
  initialMonth,
  loading = false,
  className,
}: MultiMonthCalendarProps) {
  const hydrated = useHydrated();
  const hoy = React.useMemo(() => (hydrated ? new Date() : null), [hydrated]);
  const [primerMes] = React.useState(() =>
    startOfMonth(selected ?? initialMonth ?? new Date()),
  );
  const contenedorRef = React.useRef<HTMLDivElement>(null);

  const meses = React.useMemo(
    () => Array.from({ length: months }, (_, index) => addMonths(primerMes, index)),
    [primerMes, months],
  );
  const hasta = React.useMemo(() => addMonths(primerMes, months), [primerMes, months]);

  React.useEffect(() => {
    onVisibleRangeChange?.(primerMes, hasta);
  }, [primerMes, hasta, onVisibleRangeChange]);

  // Un solo día recibe el tab: el seleccionado, hoy o el primero del rango.
  const tabbable = React.useMemo(() => {
    const enRango = (date: Date) => meses.some((mes) => mismoMes(mes, date));
    if (selected && enRango(selected)) return selected;
    if (hoy && enRango(hoy)) return hoy;
    return meses[0];
  }, [selected, hoy, meses]);

  const enfocarDia = (fecha: Date) => {
    const boton = contenedorRef.current?.querySelector<HTMLButtonElement>(
      `[data-dia="${formatDateToInput(fecha)}"]`,
    );
    boton?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const objetivo = event.target as HTMLElement;
    const atributo = objetivo.getAttribute("data-dia");
    if (!atributo) return;

    const [year, month, day] = atributo.split("-").map(Number);
    const fecha = new Date(year, month - 1, day);
    const pasos: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const paso = pasos[event.key];
    if (paso === undefined) return;

    event.preventDefault();
    enfocarDia(addDays(fecha, paso));
  };

  return (
    <div ref={contenedorRef} className={cn("space-y-3", className)}>
      {loading && (
        <p className="text-center text-[11px] text-muted-foreground" role="status">
          Consultando disponibilidad…
        </p>
      )}

      <div
        className={cn(
          "grid gap-3",
          months === 1 ? "grid-cols-1" : "sm:grid-cols-2",
          months >= 4
            ? "xl:grid-cols-4"
            : months === 3
              ? "xl:grid-cols-3"
              : "xl:grid-cols-2",
        )}
      >
        {meses.map((mes) => (
          <section
            key={mes.toISOString()}
            className="rounded-xl border border-border/60 bg-card/60 p-2"
          >
            <h3 className="mb-1.5 text-center text-xs font-semibold tracking-tight text-foreground">
              {monthLabel(mes)}
            </h3>

            <div className="grid grid-cols-7 pb-1 text-center text-[10px] font-medium text-muted-foreground">
              {DIAS_SEMANA.map((dia, index) => (
                <span key={`${dia}-${index}`} aria-hidden="true">
                  {dia}
                </span>
              ))}
            </div>

            <div
              role="grid"
              aria-label={monthLabel(mes)}
              className="grid grid-cols-7 gap-y-0.5"
              onKeyDown={onKeyDown}
            >
              {monthGridSunday(mes).map((dia) => {
                const fuera = !mismoMes(dia, mes);
                const estado = dayStatus?.(dia) ?? "available";
                const seleccionado = selected !== null && isSameDay(dia, selected);
                const esHoy = hoy !== null && isSameDay(dia, hoy);
                const antesDelMinimo = minDate
                  ? startOfDay(dia).getTime() < startOfDay(minDate).getTime()
                  : false;
                const despuesDelMaximo = maxDate
                  ? startOfDay(dia).getTime() > startOfDay(maxDate).getTime()
                  : false;
                const esPasado =
                  hoy !== null && startOfDay(dia).getTime() < startOfDay(hoy).getTime();
                const estilo = ESTADO_DIA[estado];
                const motivo = fuera
                  ? "Otro mes"
                  : esPasado
                    ? "Fecha pasada"
                    : antesDelMinimo
                      ? "Anterior a la fecha mínima"
                      : despuesDelMaximo
                        ? "Fuera de los próximos 3 meses"
                        : estilo.label;
                const deshabilitado =
                  fuera ||
                  estado === "disabled" ||
                  antesDelMinimo ||
                  despuesDelMaximo ||
                  loading;
                const esTabbable = !fuera && !deshabilitado && isSameDay(dia, tabbable);

                return (
                  <button
                    key={dia.toISOString()}
                    type="button"
                    role="gridcell"
                    data-dia={!fuera ? formatDateToInput(dia) : undefined}
                    tabIndex={esTabbable ? 0 : -1}
                    disabled={deshabilitado}
                    aria-selected={seleccionado}
                    aria-disabled={deshabilitado}
                    aria-label={`${esHoy ? "Hoy. " : ""}${formatearDiaLargo(dia)}. ${motivo}`}
                    onClick={() => {
                      if (!deshabilitado) onSelect(dia);
                    }}
                    className={cn(
                      "relative mx-auto flex size-9 items-center justify-center rounded-full text-sm tabular-nums transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 xl:size-8",
                      fuera && "text-muted-foreground/25",
                      !fuera &&
                        !deshabilitado &&
                        !seleccionado &&
                        !esHoy &&
                        "hover:bg-muted/70",
                      !fuera &&
                        !deshabilitado &&
                        !seleccionado &&
                        !esHoy &&
                        estado === "partial" &&
                        "bg-chart-2/15 text-foreground",
                      !fuera &&
                        !deshabilitado &&
                        !seleccionado &&
                        !esHoy &&
                        estado === "full" &&
                        "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                      !fuera &&
                        !deshabilitado &&
                        !seleccionado &&
                        !esHoy &&
                        estado === "no-schedule" &&
                        "text-muted-foreground/60",
                      // Hoy siempre en verde, independiente de la paleta.
                      !deshabilitado &&
                        esHoy &&
                        !seleccionado &&
                        "bg-emerald-600 font-semibold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400",
                      !deshabilitado &&
                        esHoy &&
                        seleccionado &&
                        "bg-emerald-600 font-semibold text-white shadow-xs ring-2 ring-emerald-600/30 ring-offset-2 ring-offset-card hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:ring-emerald-500/40 dark:hover:bg-emerald-400",
                      !esHoy &&
                        seleccionado &&
                        "bg-primary/10 font-semibold text-primary ring-1 ring-primary/40 hover:bg-primary/15",
                      deshabilitado &&
                        !fuera &&
                        "cursor-not-allowed text-muted-foreground/35",
                    )}
                  >
                    {dia.getDate()}
                    {!fuera &&
                      !deshabilitado &&
                      !seleccionado &&
                      !esHoy &&
                      estado !== "available" && (
                      <span
                        className={cn(
                          "absolute bottom-0.5 size-1 rounded-full",
                          estilo.punto,
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full bg-emerald-600 dark:bg-emerald-500"
            aria-hidden="true"
          />
          Hoy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2 rounded-full bg-primary/15 ring-1 ring-primary/50"
            aria-hidden="true"
          />
          Seleccionado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-chart-2" aria-hidden="true" />
          Con citas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />
          Día completo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-muted-foreground/30" aria-hidden="true" />
          Sin horario
        </span>
      </div>
    </div>
  );
}
