import { describe, expect, it } from "vitest";

import {
  calcularEstadoFecha,
  fechaMinimaPara,
  fechaMinimaSolicitud,
  filtrarHorasDisponibles,
  formatDateToInput,
  parseInputToDate,
} from "@/lib/citas";

const AHORA = new Date(2026, 9, 21, 15, 0, 0); // miércoles 21 de octubre, 15:00
const HOY = new Date(2026, 9, 21, 9, 0, 0);
const MANANA = new Date(2026, 9, 22, 9, 0, 0);

const estado = (extra: Partial<Parameters<typeof calcularEstadoFecha>[0]> = {}) =>
  calcularEstadoFecha({
    fecha: MANANA,
    horasDelDia: ["09:00", "10:00"],
    horasDisponibles: ["09:00", "10:00"],
    horasOcupadas: new Set<string>(),
    cargando: false,
    minima: null,
    ...extra,
  });

describe("fechaMinimaSolicitud", () => {
  it("es mañana a las 00:00, sin importar la hora actual", () => {
    expect(fechaMinimaSolicitud(AHORA)).toEqual(new Date(2026, 9, 22, 0, 0, 0));
    expect(fechaMinimaSolicitud(new Date(2026, 9, 21, 23, 59))).toEqual(
      new Date(2026, 9, 22, 0, 0, 0),
    );
  });
});

describe("fechaMinimaPara", () => {
  it("el paciente empieza mañana, el psicólogo hoy y la edición no tiene mínimo", () => {
    expect(fechaMinimaPara({ esPaciente: true, esEdicion: false, ahora: AHORA })).toEqual(
      new Date(2026, 9, 22, 0, 0, 0),
    );
    expect(fechaMinimaPara({ esPaciente: false, esEdicion: false, ahora: AHORA })).toEqual(
      new Date(2026, 9, 21, 0, 0, 0),
    );
    expect(fechaMinimaPara({ esPaciente: true, esEdicion: true, ahora: AHORA })).toBeNull();
  });
});

describe("filtrarHorasDisponibles", () => {
  const horas = ["09:00", "10:00", "15:00", "16:00", "18:00"];

  it("no toca las horas de otro día", () => {
    expect(filtrarHorasDisponibles(horas, MANANA, AHORA)).toEqual(horas);
  });

  it("en el día de hoy quita las franjas que ya empezaron", () => {
    expect(filtrarHorasDisponibles(horas, HOY, AHORA)).toEqual(["16:00", "18:00"]);
  });

  it("una franja justo a la hora actual ya no se ofrece", () => {
    expect(filtrarHorasDisponibles(horas, new Date(2026, 9, 21, 15, 0), AHORA)).toEqual([
      "16:00",
      "18:00",
    ]);
  });

  it("mantiene la hora de la cita en edición aunque ya haya pasado", () => {
    expect(filtrarHorasDisponibles(horas, HOY, AHORA, "10:00")).toEqual([
      "10:00",
      "16:00",
      "18:00",
    ]);
  });
});

describe("calcularEstadoFecha", () => {
  it("sin fecha", () => {
    expect(estado({ fecha: null })).toBe("sin-fecha");
  });

  it("mientras se consulta la agenda", () => {
    expect(estado({ cargando: true })).toBe("consultando");
  });

  it("día sin horario", () => {
    expect(estado({ horasDelDia: [], horasDisponibles: [] })).toBe("sin-horario");
  });

  it("día con horario pero sin franjas vigentes ni libres", () => {
    expect(estado({ horasDisponibles: [] })).toBe("lleno");
    expect(estado({ horasOcupadas: new Set(["09:00", "10:00"]) })).toBe("lleno");
  });

  it("día con al menos una franja libre", () => {
    expect(estado({ horasOcupadas: new Set(["09:00"]) })).toBe("disponible");
  });

  it("fecha anterior al mínimo", () => {
    expect(estado({ fecha: HOY, minima: new Date(2026, 9, 22, 0, 0, 0) })).toBe("no-permitida");
  });
});

describe("formatDateToInput y parseInputToDate", () => {
  it("hacen el viaje de ida y vuelta", () => {
    expect(formatDateToInput(AHORA)).toBe("2026-10-21");
    expect(parseInputToDate("2026-10-21")).toEqual(new Date(2026, 9, 21, 9, 0, 0));
  });
});
