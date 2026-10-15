import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppointmentModality,
  AppointmentStatus as SharedStatus,
  UserRole,
} from "@psicoagenda/shared";

const { prismaMock } = vi.hoisted(() => {
  const appointment = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  };
  const patient = { findUnique: vi.fn() };
  const psychologist = { findUnique: vi.fn() };

  return { prismaMock: { appointment, patient, psychologist, $transaction: vi.fn() } };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  disconnectPrisma: vi.fn(),
}));

const {
  cancelAppointment,
  changeAppointmentStatus,
  createAppointment,
  getAppointmentById,
  listAppointments,
  updateAppointment,
} = await import("@/services/appointment.service");

/**
 * Recupera el argumento de la última llamada a un espía. Evita el matcher
 * `expect.objectContaining` anidado, que devuelve `any` y activa
 * `no-unsafe-assignment`.
 */
function lastCallArg(mock: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  const call = mock.mock.calls.at(-1);
  return (call?.[0] ?? {}) as Record<string, unknown>;
}

const PSYCH_USER_ID = "11111111-1111-4111-8111-111111111111";
const PSYCH_ID = "22222222-2222-4222-8222-222222222222";
const PATIENT_USER_ID = "33333333-3333-4333-8333-333333333333";
const PATIENT_ID = "44444444-4444-4444-8444-444444444444";
const APPOINTMENT_ID = "55555555-5555-4555-8555-555555555555";

const psychologist = { id: PSYCH_USER_ID, email: "psi@psicoagenda.test", role: UserRole.PSYCHOLOGIST };
const patient = { id: PATIENT_USER_ID, email: "pac@psicoagenda.test", role: UserRole.PATIENT };
const admin = { id: "66666666-6666-4666-8666-666666666666", email: "adm@psicoagenda.test", role: UserRole.ADMIN };

const START = new Date("2030-01-01T10:00:00.000Z");

function appointmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPOINTMENT_ID,
    psychologistId: PSYCH_ID,
    patientId: PATIENT_ID,
    requestId: null,
    start: START,
    end: new Date("2030-01-01T11:00:00.000Z"),
    status: "CONFIRMED",
    modality: "IN_PERSON",
    sessionType: "INDIVIDUAL",
    reason: null,
    internalNotes: null,
    cancelReason: null,
    cancelledById: null,
    cancelledAt: null,
    createdAt: START,
    updatedAt: START,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prismaMock));
  prismaMock.psychologist.findUnique.mockResolvedValue({ id: PSYCH_ID });
  prismaMock.patient.findUnique.mockResolvedValue({ id: PATIENT_ID, psychologistId: null });
  prismaMock.appointment.findFirst.mockResolvedValue(null);
});

describe("createAppointment", () => {
  it("infiere el psicólogo de la sesión y marca la primera visita como consulta inicial", async () => {
    prismaMock.appointment.count.mockResolvedValue(0);
    prismaMock.appointment.create.mockResolvedValue(appointmentRow({ sessionType: "CONSULTA_INICIAL" }));

    const result = await createAppointment(psychologist, {
      patientId: PATIENT_ID,
      startTime: START,
      durationMinutes: 60,
      modality: AppointmentModality.IN_PERSON,
    });

    const { data } = lastCallArg(prismaMock.appointment.create) as { data: Record<string, unknown> };

    expect(data).toMatchObject({
      psychologistId: PSYCH_ID,
      patientId: PATIENT_ID,
      status: "CONFIRMED",
      sessionType: "INITIAL_CONSULTATION",
    });
    expect(result.id).toBe(APPOINTMENT_ID);
  });

  it("marca como sesión individual cuando el paciente ya tenía citas", async () => {
    prismaMock.appointment.count.mockResolvedValue(2);
    prismaMock.appointment.create.mockResolvedValue(appointmentRow());

    await createAppointment(psychologist, {
      patientId: PATIENT_ID,
      startTime: START,
      durationMinutes: 45,
      modality: AppointmentModality.IN_PERSON,
    });

    const { data } = lastCallArg(prismaMock.appointment.create) as { data: Record<string, unknown> };

    expect(data).toMatchObject({ sessionType: "INDIVIDUAL" });
  });

  it("rechaza con 409 cuando el psicólogo ya tiene una cita en ese horario", async () => {
    prismaMock.appointment.count.mockResolvedValue(0);
    prismaMock.appointment.findFirst.mockResolvedValueOnce({ id: "otra-cita" });

    await expect(
      createAppointment(psychologist, {
        patientId: PATIENT_ID,
        startTime: START,
        durationMinutes: 60,
        modality: AppointmentModality.IN_PERSON,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it("hereda el psicólogo del paciente cuando quien agenda es el propio paciente", async () => {
    prismaMock.patient.findUnique.mockResolvedValue({ id: PATIENT_ID, psychologistId: PSYCH_ID });
    prismaMock.appointment.count.mockResolvedValue(0);
    prismaMock.appointment.create.mockResolvedValue(appointmentRow());

    await createAppointment(patient, {
      patientId: PATIENT_ID,
      startTime: START,
      durationMinutes: 60,
      modality: AppointmentModality.IN_PERSON,
    });

    const { data } = lastCallArg(prismaMock.appointment.create) as { data: Record<string, unknown> };

    expect(data).toMatchObject({ psychologistId: PSYCH_ID });
  });

  it("impide que un paciente agende para otra persona", async () => {
    await expect(
      createAppointment(patient, {
        patientId: "99999999-9999-4999-8999-999999999999",
        startTime: START,
        durationMinutes: 60,
        modality: AppointmentModality.IN_PERSON,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });
});

describe("listAppointments", () => {
  it("restringe al paciente a sus propias citas aunque pida otro paciente", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);

    await listAppointments(patient, { patientId: "99999999-9999-4999-8999-999999999999" });

    const { where } = lastCallArg(prismaMock.appointment.findMany) as { where: Record<string, unknown> };

    expect(where).toMatchObject({ patientId: PATIENT_ID });
  });

  it("traduce el estado compartido al valor del esquema en los filtros", async () => {
    prismaMock.appointment.findMany.mockResolvedValue([]);

    await listAppointments(admin, { status: SharedStatus.CONFIRMED });

    const { where } = lastCallArg(prismaMock.appointment.findMany) as { where: Record<string, unknown> };

    expect(where).toMatchObject({ status: "CONFIRMED" });
  });
});

describe("getAppointmentById", () => {
  it("devuelve 404 si la cita no existe", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(null);

    await expect(getAppointmentById(APPOINTMENT_ID, admin)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("impide que un paciente vea una cita ajena", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(appointmentRow({ patientId: "otro-paciente" }));

    await expect(getAppointmentById(APPOINTMENT_ID, patient)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("deriva la asistencia y traduce los enums al formato de la interfaz", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(appointmentRow({ status: "COMPLETED" }));

    const result = await getAppointmentById(APPOINTMENT_ID, admin);

    expect(result).toMatchObject({
      status: SharedStatus.COMPLETED,
      attendanceStatus: "attended",
      durationMinutes: 60,
    });
  });
});

describe("updateAppointment", () => {
  it("impide que un paciente modifique una cita", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(appointmentRow());

    await expect(
      updateAppointment(patient, APPOINTMENT_ID, { reason: "otro" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("recalcula el fin cuando cambia la hora de inicio", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(appointmentRow());
    prismaMock.appointment.update.mockResolvedValue(
      appointmentRow({ start: new Date("2030-01-01T12:00:00.000Z"), end: new Date("2030-01-01T13:00:00.000Z") }),
    );

    await updateAppointment(psychologist, APPOINTMENT_ID, {
      startTime: new Date("2030-01-01T12:00:00.000Z"),
    });

    const { data } = lastCallArg(prismaMock.appointment.update) as { data: Record<string, unknown> };

    expect(data).toMatchObject({
      start: new Date("2030-01-01T12:00:00.000Z"),
      end: new Date("2030-01-01T13:00:00.000Z"),
    });
  });
});

describe("changeAppointmentStatus", () => {
  it("traduce el estado compartido al valor persistido", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(appointmentRow());
    prismaMock.appointment.update.mockResolvedValue(appointmentRow({ status: "NO_SHOW" }));

    const result = await changeAppointmentStatus(psychologist, APPOINTMENT_ID, SharedStatus.NO_SHOW);

    const { data } = lastCallArg(prismaMock.appointment.update) as { data: Record<string, unknown> };

    expect(data).toEqual({ status: "NO_SHOW" });
    expect(result.status).toBe(SharedStatus.NO_SHOW);
  });
});

describe("cancelAppointment", () => {
  it("verifica que el paciente cancele su propia cita y deja el motivo", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(appointmentRow({ patientId: PATIENT_ID }));
    prismaMock.appointment.update.mockResolvedValue(appointmentRow({ status: "CANCELLED" }));

    await cancelAppointment(patient, APPOINTMENT_ID, "Me surgió un imprevisto");

    const { data } = lastCallArg(prismaMock.appointment.update) as { data: Record<string, unknown> };

    expect(data).toMatchObject({
      status: "CANCELLED",
      cancelReason: "Me surgió un imprevisto",
      cancelledById: PATIENT_USER_ID,
    });
    expect(data.cancelledAt).toBeInstanceOf(Date);
  });

  it("rechaza cancelar una cita ya cancelada", async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(appointmentRow({ status: "CANCELLED" }));

    await expect(cancelAppointment(admin, APPOINTMENT_ID, "motivo")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });
});
