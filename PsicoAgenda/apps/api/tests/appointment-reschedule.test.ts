import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppointmentModality,
  AppointmentRequestStatus,
  UserRole,
} from "@psicoagenda/shared";

const { prismaMock, notificar } = vi.hoisted(() => {
  const citas = {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
  };
  const pacientes = { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() };
  const solicitudes_cita = { findFirst: vi.fn(), create: vi.fn() };
  const pagos_honorarios = { deleteMany: vi.fn() };

  return {
    prismaMock: { citas, pacientes, solicitudes_cita, pagos_honorarios, $transaction: vi.fn() },
    notificar: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  disconnectPrisma: vi.fn(),
}));

vi.mock("@/services/notification.service", () => ({ notificar }));
vi.mock("@/services/guardianship.service", async () => {
  const { tutelaSinVinculos } = await import("./helpers/tutela-sin-vinculos");
  return tutelaSinVinculos(prismaMock.pacientes);
});

const { rescheduleAppointmentRequest } = await import("@/services/appointment-request.service");

const PATIENT_USER_ID = "33333333-3333-4333-8333-333333333333";
const PATIENT_ID = "44444444-4444-4444-8444-444444444444";
const PSYCH_ID = "22222222-2222-4222-8222-222222222222";
const APPOINTMENT_ID = "55555555-5555-4555-8555-555555555555";
const REQUEST_ID = "77777777-7777-4777-8777-777777777777";

const START = new Date("2030-01-01T10:00:00.000Z");
const NEW_START = new Date("2030-01-05T15:00:00.000Z");

const patient = { id: PATIENT_USER_ID, email: "pac@psicoagenda.test", role: UserRole.PATIENT };

function currentAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: APPOINTMENT_ID,
    paciente_id: PATIENT_ID,
    psicologo_id: PSYCH_ID,
    inicio: START,
    fin: new Date(START.getTime() + 50 * 60_000),
    modalidad: "PRESENCIAL",
    estado: "CONFIRMADA",
    ...overrides,
  };
}

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REQUEST_ID,
    paciente_id: PATIENT_ID,
    psicologo_id: PSYCH_ID,
    inicio_solicitado: NEW_START,
    duracion_minutos: 50,
    modalidad: "PRESENCIAL",
    motivo: null,
    estado: "PENDIENTE",
    citas: null,
    creado_en: new Date("2029-12-01T00:00:00.000Z"),
    atendida_en: null,
    ...overrides,
  };
}

function lastCallArg(mock: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  const call = mock.mock.calls.at(-1);
  return (call?.[0] ?? {}) as Record<string, unknown>;
}

const input = {
  appointmentId: APPOINTMENT_ID,
  startTime: NEW_START,
  durationMinutes: 50,
  modality: AppointmentModality.IN_PERSON,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prismaMock));
  prismaMock.pacientes.findUnique.mockResolvedValue({ id: PATIENT_ID });
  prismaMock.pacientes.findUniqueOrThrow.mockResolvedValue({
    id: PATIENT_ID,
    psicologo_id: PSYCH_ID,
  });
  prismaMock.citas.findUnique.mockResolvedValue(currentAppointment());
  prismaMock.citas.findFirst.mockResolvedValue(null);
  prismaMock.citas.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.citas.count.mockResolvedValue(1);
  prismaMock.solicitudes_cita.findFirst.mockResolvedValue(null);
  prismaMock.solicitudes_cita.create.mockResolvedValue(requestRow());
});

describe("rescheduleAppointmentRequest", () => {
  it("cancela la cita actual y crea la solicitud en una sola transacción", async () => {
    const result = await rescheduleAppointmentRequest(patient, input);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.pagos_honorarios.deleteMany).toHaveBeenCalledWith({
      where: { cita_id: APPOINTMENT_ID, estado: "PENDIENTE" },
    });

    const cancel = lastCallArg(prismaMock.citas.updateMany) as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(cancel.where).toMatchObject({ id: APPOINTMENT_ID });
    expect(cancel.data).toMatchObject({
      estado: "CANCELADA",
      cancelada_por_id: PATIENT_USER_ID,
    });
    expect(String(cancel.data.motivo_cancelacion)).toContain("Reagendamiento");
    expect(cancel.data.cancelada_en).toBeInstanceOf(Date);

    const created = lastCallArg(prismaMock.solicitudes_cita.create) as {
      data: Record<string, unknown>;
    };
    expect(created.data).toMatchObject({
      paciente_id: PATIENT_ID,
      psicologo_id: PSYCH_ID,
      inicio_solicitado: NEW_START,
      duracion_minutos: 50,
      modalidad: "PRESENCIAL",
    });

    expect(result).toMatchObject({
      id: REQUEST_ID,
      status: AppointmentRequestStatus.PENDING,
      startTime: NEW_START,
    });
    const llamadaCancelacion = notificar.mock.calls[0] as unknown[] | undefined;
    const avisoCancelacion = llamadaCancelacion?.[1] as Record<string, unknown> | undefined;
    expect(llamadaCancelacion?.[0]).toBe("CITA_CANCELADA_POR_PACIENTE");
    expect(avisoCancelacion).toMatchObject({
      citaId: APPOINTMENT_ID,
      pacienteId: PATIENT_ID,
      psicologoId: PSYCH_ID,
    });
    expect(String(avisoCancelacion?.motivoCancelacion)).toContain("Reagendamiento");

    const llamadaSolicitud = notificar.mock.calls[1] as unknown[] | undefined;
    expect(llamadaSolicitud?.[0]).toBe("SOLICITUD_CREADA");
    expect(llamadaSolicitud?.[1]).toMatchObject({
      pacienteId: PATIENT_ID,
      psicologoId: PSYCH_ID,
    });
  });

  it("rechaza reagendar la cita de otro paciente", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(
      currentAppointment({ paciente_id: "99999999-9999-4999-8999-999999999999" }),
    );

    await expect(rescheduleAppointmentRequest(patient, input)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("exige un horario distinto al actual", async () => {
    await expect(
      rescheduleAppointmentRequest(patient, { ...input, startTime: START }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("exige un horario futuro", async () => {
    await expect(
      rescheduleAppointmentRequest(patient, {
        ...input,
        startTime: new Date(Date.now() - 60_000),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza una cita ya cancelada", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(currentAppointment({ estado: "CANCELADA" }));

    await expect(rescheduleAppointmentRequest(patient, input)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("no crea la solicitud si el psicólogo ya tiene una cita en ese horario", async () => {
    prismaMock.citas.findFirst.mockResolvedValueOnce({
      id: "88888888-8888-4888-8888-888888888888",
    });

    await expect(rescheduleAppointmentRequest(patient, input)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.solicitudes_cita.create).not.toHaveBeenCalled();
  });

  it("no duplica una solicitud pendiente para el mismo horario", async () => {
    prismaMock.solicitudes_cita.findFirst.mockResolvedValue({ id: "otra-solicitud" });

    await expect(rescheduleAppointmentRequest(patient, input)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.solicitudes_cita.create).not.toHaveBeenCalled();
  });
});
