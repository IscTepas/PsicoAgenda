import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@psicoagenda/shared";
import { estado_consentimiento, estado_expediente } from "@/generated/prisma/enums";

const { db } = vi.hoisted(() => ({
  db: {
    pacientes: { findUnique: vi.fn() },
    psicologos: { findUnique: vi.fn() },
    expedientes_clinicos: { findUnique: vi.fn(), create: vi.fn() },
    consentimientos_informados: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

const { getOrCreateClinicalRecord } = await import("@/services/clinical-record.service");

const admin = { id: "u-admin", email: "admin@x.com", role: UserRole.ADMIN } as never;

const tutor = {
  id: "t-1",
  nombre_completo: "María Ejemplo",
  telefono: "3111234567",
  parentesco: "Madre",
  creado_en: new Date("2025-01-01T00:00:00Z"),
  usuarios: { correo: "maria@ejemplo.com" },
};

const consentimiento = (over: Record<string, unknown> = {}) => ({
  id: "c-1",
  paciente_id: "p-1",
  firmado_en: new Date("2026-02-01T00:00:00Z"),
  documento: "Consentimiento informado",
  documento_url: null,
  tutor_legal_id: "t-1",
  estado: estado_consentimiento.FIRMADO,
  retirado_en: null,
  creado_en: new Date("2026-02-01T00:00:00Z"),
  tutores: tutor,
  ...over,
});

const expediente = () => ({
  id: "r-1",
  paciente_id: "p-1",
  abierto_en: new Date("2026-01-01T00:00:00Z"),
  motivo_consulta: null,
  antecedentes: null,
  diagnostico: null,
  observaciones_generales: null,
  estado: estado_expediente.ACTIVO,
  conservar_hasta: null,
  actualizado_en: new Date("2026-01-02T00:00:00Z"),
});

beforeEach(() => {
  vi.clearAllMocks();
  db.pacientes.findUnique.mockResolvedValue({ id: "p-1", psicologo_id: null });
  db.expedientes_clinicos.findUnique.mockResolvedValue(expediente());
  db.consentimientos_informados.findMany.mockResolvedValue([consentimiento()]);
});

describe("consentimientos en el expediente", () => {
  it("resuelve el tutor que firmó cada consentimiento", async () => {
    const record = await getOrCreateClinicalRecord(admin, "p-1");

    expect(record.consents).toHaveLength(1);
    expect(record.consents[0]).toMatchObject({
      id: "c-1",
      patientId: "p-1",
      legalGuardianId: "t-1",
      status: "signed",
      legalGuardian: {
        id: "t-1",
        name: "María Ejemplo",
        phone: "3111234567",
        relationship: "Madre",
        email: "maria@ejemplo.com",
        hasAccount: true,
      },
    });
  });

  it("un consentimiento firmado por el propio paciente no inventa tutor", async () => {
    db.consentimientos_informados.findMany.mockResolvedValue([
      consentimiento({
        tutor_legal_id: null,
        tutores: null,
        estado: estado_consentimiento.VENCIDO,
      }),
    ]);

    const record = await getOrCreateClinicalRecord(admin, "p-1");

    expect(record.consents[0]?.legalGuardian).toBeUndefined();
    expect(record.consents[0]?.status).toBe("expired");
  });

  it("crea el expediente y conserva los consentimientos del paciente", async () => {
    db.expedientes_clinicos.findUnique.mockResolvedValue(null);
    db.expedientes_clinicos.create.mockResolvedValue(expediente());

    const record = await getOrCreateClinicalRecord(admin, "p-1");

    const createArgs = db.expedientes_clinicos.create.mock.calls[0]?.[0] as
      | { data: { paciente_id: string } }
      | undefined;
    expect(createArgs?.data.paciente_id).toBe("p-1");
    expect(db.consentimientos_informados.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { paciente_id: "p-1" } }),
    );
    expect(record.consents).toHaveLength(1);
  });
});
