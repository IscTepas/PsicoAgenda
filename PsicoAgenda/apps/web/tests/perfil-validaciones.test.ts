import { describe, expect, it } from "vitest";

import {
  updatePatientProfileSchema,
  updatePsychologistProfileSchema,
} from "@psicoagenda/shared";

describe("updatePatientProfileSchema", () => {
  it("acepta un perfil completo válido", () => {
    const resultado = updatePatientProfileSchema.safeParse({
      name: "  Ana Pérez  ",
      phone: "555-123-4567",
      timeZone: "America/Mexico_City",
      emergencyContactName: "Luis Pérez",
      emergencyContactPhone: "551-234-5678",
    });

    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.name).toBe("Ana Pérez");
    }
  });

  it("el teléfono es opcional, pero si viene debe tener 10 dígitos", () => {
    expect(updatePatientProfileSchema.safeParse({}).success).toBe(true);
    expect(updatePatientProfileSchema.safeParse({ phone: "5551234567" }).success).toBe(true);
    expect(updatePatientProfileSchema.safeParse({ phone: "555-123-456" }).success).toBe(false);
    expect(updatePatientProfileSchema.safeParse({ phone: "555-123-45678" }).success).toBe(false);
    expect(updatePatientProfileSchema.safeParse({ phone: "teléfono" }).success).toBe(false);
  });

  it("rechaza nombres demasiado cortos o largos", () => {
    expect(updatePatientProfileSchema.safeParse({ name: "A" }).success).toBe(false);
    expect(updatePatientProfileSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(updatePatientProfileSchema.safeParse({ name: "a".repeat(121) }).success).toBe(false);
  });

  it("rechaza zonas horarias fuera de la lista", () => {
    expect(updatePatientProfileSchema.safeParse({ timeZone: "UTC" }).success).toBe(false);
    expect(updatePatientProfileSchema.safeParse({ timeZone: "America/Cancun" }).success).toBe(
      true,
    );
  });

  it("valida la foto: data URL de imagen o https", () => {
    const png = "data:image/png;base64,iVBORw0KGgo=";
    expect(updatePatientProfileSchema.safeParse({ photoUrl: png }).success).toBe(true);
    expect(
      updatePatientProfileSchema.safeParse({ photoUrl: "https://cdn.example.com/foto.png" })
        .success,
    ).toBe(true);
    expect(
      updatePatientProfileSchema.safeParse({ photoUrl: "data:text/html;base64,PHNjcmlwdD4=" })
        .success,
    ).toBe(false);
    expect(updatePatientProfileSchema.safeParse({ photoUrl: "javascript:alert(1)" }).success).toBe(
      false,
    );
  });

  it("rechaza un nombre de contacto de un solo carácter", () => {
    expect(
      updatePatientProfileSchema.safeParse({ emergencyContactName: "L" }).success,
    ).toBe(false);
  });
});

describe("updatePsychologistProfileSchema", () => {
  it("acepta una cédula con formato razonable", () => {
    expect(updatePsychologistProfileSchema.safeParse({ licenseNumber: "PSI-12345" }).success).toBe(
      true,
    );
    expect(updatePsychologistProfileSchema.safeParse({ licenseNumber: "12345678" }).success).toBe(
      true,
    );
  });

  it("rechaza cédulas demasiado cortas o con caracteres raros", () => {
    expect(updatePsychologistProfileSchema.safeParse({ licenseNumber: "12" }).success).toBe(false);
    expect(updatePsychologistProfileSchema.safeParse({ licenseNumber: "PSI#12345" }).success).toBe(
      false,
    );
    expect(updatePsychologistProfileSchema.safeParse({ licenseNumber: "a".repeat(31) }).success).toBe(
      false,
    );
  });

  it("valida el teléfono con la misma regla que el paciente", () => {
    expect(updatePsychologistProfileSchema.safeParse({ phone: "5512345678" }).success).toBe(true);
    expect(updatePsychologistProfileSchema.safeParse({ phone: "551234567" }).success).toBe(false);
  });
});
