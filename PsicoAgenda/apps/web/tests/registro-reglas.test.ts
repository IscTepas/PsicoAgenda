import { describe, expect, it } from "vitest";
import {
  AppointmentStatus,
  direccionOpcionalSchema,
  emailSchema,
  nombreCompletoSchema,
  tieneEdadMinima,
} from "@psicoagenda/shared";
import { citaModificablePorPaciente } from "@/lib/citas";

describe("nombreCompletoSchema", () => {
  it("pide nombre y apellido", () => {
    expect(nombreCompletoSchema.safeParse("Ana").success).toBe(false);
    expect(nombreCompletoSchema.safeParse("Ana P").success).toBe(false);
    expect(nombreCompletoSchema.safeParse("Ana Pérez").success).toBe(true);
    expect(nombreCompletoSchema.safeParse("María José O'Neil-Ruiz").success).toBe(true);
  });

  it("no acepta números ni símbolos", () => {
    expect(nombreCompletoSchema.safeParse("Ana Pérez 2").success).toBe(false);
    expect(nombreCompletoSchema.safeParse("Ana @Pérez").success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("exige dominio con terminación y normaliza", () => {
    expect(emailSchema.safeParse("ana@correo").success).toBe(false);
    expect(emailSchema.safeParse("ana correo.com").success).toBe(false);
    expect(emailSchema.parse("  Ana@Correo.COM ")).toBe("ana@correo.com");
  });
});

describe("direccionOpcionalSchema", () => {
  it("vacía pasa; si se escribe, pide al menos 10 caracteres", () => {
    expect(direccionOpcionalSchema.safeParse("").success).toBe(true);
    expect(direccionOpcionalSchema.safeParse(undefined).success).toBe(true);
    expect(direccionOpcionalSchema.safeParse("Calle 1").success).toBe(false);
    expect(direccionOpcionalSchema.safeParse("Av. Madero 153, Tepic").success).toBe(true);
  });
});

describe("tieneEdadMinima", () => {
  const hoy = new Date(2026, 10, 19);
  it("pide al menos 3 meses de nacido", () => {
    expect(tieneEdadMinima("2026-10-01", hoy)).toBe(false);
    expect(tieneEdadMinima("2026-08-20", hoy)).toBe(false);
    expect(tieneEdadMinima("2026-08-19", hoy)).toBe(true);
    expect(tieneEdadMinima("1990-05-01", hoy)).toBe(true);
  });
});

describe("citaModificablePorPaciente", () => {
  const ahora = new Date("2026-11-19T18:00:00Z");
  const cita = (inicio: string, status = AppointmentStatus.CONFIRMED) => ({
    startTime: new Date(inicio),
    durationMinutes: 50,
    status,
  });

  it("solo las abiertas que no han terminado", () => {
    expect(citaModificablePorPaciente(cita("2026-11-20T16:00:00Z"), ahora)).toBe(true);
    expect(citaModificablePorPaciente(cita("2026-11-18T16:00:00Z"), ahora)).toBe(false);
    expect(citaModificablePorPaciente(cita("2026-11-20T16:00:00Z", AppointmentStatus.CANCELLED), ahora)).toBe(false);
    expect(citaModificablePorPaciente(cita("2026-11-20T16:00:00Z", AppointmentStatus.COMPLETED), ahora)).toBe(false);
  });
});
