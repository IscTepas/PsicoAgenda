import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@psicoagenda/shared";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { patient: { findMany: vi.fn(), findUnique: vi.fn() } },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  disconnectPrisma: vi.fn(),
}));

const { getPatientById, listPatients } = await import("@/services/patient.service");

const PATIENT_USER_ID = "33333333-3333-4333-8333-333333333333";
const PATIENT_ID = "44444444-4444-4444-8444-444444444444";

const patient = { id: PATIENT_USER_ID, email: "pac@psicoagenda.test", role: UserRole.PATIENT };

function patientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: PATIENT_ID,
    userId: PATIENT_USER_ID,
    birthDate: null,
    gender: null,
    address: null,
    psychologistId: null,
    legalGuardianId: null,
    user: {
      id: PATIENT_USER_ID,
      email: "pac@psicoagenda.test",
      name: "Paciente de prueba",
      phone: null,
      isActive: true,
      createdAt: new Date("2030-01-01T00:00:00.000Z"),
      updatedAt: new Date("2030-01-01T00:00:00.000Z"),
    },
    legalGuardian: null,
    emergencyContacts: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listPatients", () => {
  it("filtra por el propio usuario cuando quien consulta es un paciente", async () => {
    prismaMock.patient.findMany.mockResolvedValue([]);

    await listPatients(patient);

    const call = prismaMock.patient.findMany.mock.calls.at(-1);
    const args = (call?.[0] ?? {}) as { where?: Record<string, unknown> };

    expect(args.where).toMatchObject({ userId: PATIENT_USER_ID });
  });
});

describe("getPatientById", () => {
  it("devuelve 404 si el paciente no existe", async () => {
    prismaMock.patient.findUnique.mockResolvedValue(null);

    await expect(getPatientById(PATIENT_ID, patient)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("mapea la fila a la forma pública con el contacto de emergencia principal", async () => {
    prismaMock.patient.findUnique.mockResolvedValue(
      patientRow({
        emergencyContacts: [
          { id: "c1", patientId: PATIENT_ID, name: "Madre", phone: "3000000000", relationship: "Madre", isPrimary: false, createdAt: new Date("2030-01-01T00:00:00.000Z") },
          { id: "c2", patientId: PATIENT_ID, name: "Padre", phone: "3111111111", relationship: null, isPrimary: true, createdAt: new Date("2030-01-01T00:00:00.000Z") },
        ],
      }),
    );

    const result = await getPatientById(PATIENT_ID, patient);

    expect(result).toMatchObject({
      id: PATIENT_ID,
      email: "pac@psicoagenda.test",
      name: "Paciente de prueba",
      role: UserRole.PATIENT,
      emergencyContact: { name: "Padre", isPrimary: true },
    });
  });

  it("impide que un paciente consulte el expediente de otro", async () => {
    prismaMock.patient.findUnique.mockResolvedValue(patientRow({ userId: "otro-usuario" }));

    await expect(getPatientById(PATIENT_ID, patient)).rejects.toMatchObject({ statusCode: 403 });
  });
});
