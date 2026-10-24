import { describe, expect, it } from "vitest";

import {
  addMonths,
  agruparOcupacionPorDia,
  calcularEstadoDia,
  monthGridSunday,
  startOfMonth,
} from "@/lib/calendario";

const AHORA = new Date(2026, 9, 21, 15, 0, 0); // miércoles 21 de octubre, 15:00
const HOY = new Date(2026, 9, 21, 9, 0, 0);
const MANANA = new Date(2026, 9, 22, 9, 0, 0);
const AYER = new Date(2026, 9, 20, 9, 0, 0);

const estado = (extra: Partial<Parameters<typeof calcularEstadoDia>[0]> = {}) =>
  calcularEstadoDia({
    fecha: MANANA,
    hoy: HOY,
    minima: null,
    maxima: null,
    horasDelDia: ["09:00", "10:00"],
    horasOcupadas: new Set<string>(),
    ahora: AHORA,
    ...extra,
  });

describe("monthGridSunday", () => {
  it("empieza en domingo y completa 6 semanas", () => {
    const octubre = startOfMonth(new Date(2026, 9, 15));
    const dias = monthGridSunday(octubre);

    expect(dias).toHaveLength(42);
    expect(dias[0]).toEqual(new Date(2026, 8, 27)); // domingo 27 de septiembre
    expect(dias[41]).toEqual(new Date(2026, 10, 7)); // sábado 7 de noviembre
  });

  it("el primer día del mes cae en su celda correcta", () => {
    const dias = monthGridSunday(new Date(2026, 9, 1)); // jueves 1 de octubre
    const indice = dias.findIndex((dia) => dia.getDate() === 1 && dia.getMonth() === 9);

    expect(indice).toBe(4); // domingo, lunes, martes, miércoles, jueves
  });
});

describe("addMonths", () => {
  it("cruza el fin de año sin desbordar el día", () => {
    expect(addMonths(new Date(2026, 11, 1), 1)).toEqual(new Date(2027, 0, 1));
    expect(addMonths(new Date(2026, 0, 1), -1)).toEqual(new Date(2025, 11, 1));
  });
});

describe("calcularEstadoDia", () => {
  it("deshabilita los días pasados y los anteriores al mínimo", () => {
    expect(estado({ fecha: AYER })).toBe("disabled");
    expect(estado({ fecha: HOY, minima: MANANA })).toBe("disabled");
    expect(estado({ fecha: HOY, hoy: null, ahora: new Date(2026, 9, 21, 8, 0) })).toBe(
      "available",
    );
  });

  it("deshabilita los días posteriores al máximo", () => {
    expect(estado({ fecha: new Date(2026, 9, 23), maxima: MANANA })).toBe("disabled");
    expect(estado({ fecha: MANANA, maxima: MANANA })).toBe("available");
  });

  it("marca sin horario cuando el profesional no atiende ese día", () => {
    expect(estado({ horasDelDia: [] })).toBe("no-schedule");
  });

  it("distingue disponible, con citas y lleno", () => {
    expect(estado()).toBe("available");
    expect(estado({ horasOcupadas: new Set(["09:00"]) })).toBe("partial");
    expect(estado({ horasOcupadas: new Set(["09:00", "10:00"]) })).toBe("full");
  });

  it("hoy sin horas vigentes queda como día completo", () => {
    expect(estado({ fecha: HOY, minima: null, horasDelDia: ["09:00"] })).toBe("full");
  });
});

describe("agruparOcupacionPorDia", () => {
  it("agrupa por fecha local y hora de inicio", () => {
    const mapa = agruparOcupacionPorDia([
      { startTime: new Date(2026, 9, 22, 9, 30) },
      { startTime: new Date(2026, 9, 22, 15, 0) },
      { startTime: new Date(2026, 9, 23, 10, 0) },
    ]);

    expect([...mapa.get("2026-10-22")!]).toEqual(["09:00", "15:00"]);
    expect([...mapa.get("2026-10-23")!]).toEqual(["10:00"]);
    expect(mapa.size).toBe(2);
  });
});
