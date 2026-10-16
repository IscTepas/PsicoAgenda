import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@psicoagenda/shared";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { pacientes: { findMany: vi.fn(), findUnique: vi.fn() } },
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
    usuario_id: PATIENT_USER_ID,
    fecha_nacimiento: null,
    sexo: null,
    direccion: null,
    tutor_legal_id: null,
    psicologo_id: null,
    usuarios: {
      id: PATIENT_USER_ID,
      correo: "pac@psicoagenda.test",
      nombre_completo: "Paciente de prueba",
      telefono: null,
      zona_horaria: "UTC",
      foto_perfil_url: null,
      notificar_whatsapp: false,
      notificar_correo: true,
      creado_en: new Date("2030-01-01T00:00:00.000Z"),
      actualizado_en: new Date("2030-01-01T00:00:00.000Z"),
    },
    tutores_legales: null,
    contactos_emergencia: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listPatients", () => {
  it("filtra por el propio usuario cuando quien consulta es un paciente", async () => {
    prismaMock.pacientes.findMany.mockResolvedValue([]);

    await listPatients(patient);

    const call = prismaMock.pacientes.findMany.mock.calls.at(-1);
    const args = (call?.[0] ?? {}) as { where?: Record<string, unknown> };

    expect(args.where).toMatchObject({ usuario_id: PATIENT_USER_ID });
  });
});

describe("getPatientById", () => {
  it("devuelve 404 si el paciente no existe", async () => {
    prismaMock.pacientes.findUnique.mockResolvedValue(null);

    await expect(getPatientById(PATIENT_ID, patient)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("mapea la fila a la forma pública con el contacto de emergencia principal", async () => {
    prismaMock.pacientes.findUnique.mockResolvedValue(
      patientRow({
        contactos_emergencia: [
          { id: "c1", paciente_id: PATIENT_ID, nombre_completo: "Madre", telefono: "3000000000", parentesco: "Madre", es_principal: false, creado_en: new Date("2030-01-01T00:00:00.000Z") },
          { id: "c2", paciente_id: PATIENT_ID, nombre_completo: "Padre", telefono: "3111111111", parentesco: null, es_principal: true, creado_en: new Date("2030-01-01T00:00:00.000Z") },
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
    prismaMock.pacientes.findUnique.mockResolvedValue(patientRow({ usuario_id: "otro-usuario" }));

    await expect(getPatientById(PATIENT_ID, patient)).rejects.toMatchObject({ statusCode: 403 });
  });
});
