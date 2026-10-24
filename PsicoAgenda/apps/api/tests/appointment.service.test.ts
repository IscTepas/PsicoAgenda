import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AppointmentModality,
  AppointmentStatus as SharedStatus,
  PaymentStatus,
  UserRole,
} from "@psicoagenda/shared";

const { prismaMock } = vi.hoisted(() => {
  const citas = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  };
  const pacientes = { findUnique: vi.fn() };
  const psicologos = { findUnique: vi.fn() };
  const pagos_honorarios = { create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() };

  return { prismaMock: { citas, pacientes, psicologos, pagos_honorarios, $transaction: vi.fn() } };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  disconnectPrisma: vi.fn(),
}));

// Los avisos tienen su propia suite; aquí solo importa que no toquen la base.
const { notificar } = vi.hoisted(() => ({ notificar: vi.fn() }));
vi.mock("@/services/notification.service", () => ({ notificar }));

const {
  cancelAppointment,
  changeAppointmentStatus,
  createAppointment,
  getAppointmentById,
  listAppointmentOccupancy,
  listAppointments,
  updateAppointment,
  updateAppointmentPayment,
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
    psicologo_id: PSYCH_ID,
    paciente_id: PATIENT_ID,
    solicitud_id: null,
    inicio: START,
    fin: new Date("2030-01-01T11:00:00.000Z"),
    estado: "CONFIRMADA",
    modalidad: "PRESENCIAL",
    tipo_sesion: "INDIVIDUAL",
    motivo: null,
    notas_internas: null,
    motivo_cancelacion: null,
    precio: null,
    cancelada_por_id: null,
    cancelada_en: null,
    creado_en: START,
    actualizado_en: START,
    // Relación 1:1 con los honorarios de la cita.
    pagos_honorarios: null,
    ...overrides,
  };
}

function paymentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    cita_id: APPOINTMENT_ID,
    monto: "800",
    estado: "PENDIENTE",
    pagado_en: null,
    creado_en: START,
    actualizado_en: START,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prismaMock));
  prismaMock.psicologos.findUnique.mockResolvedValue({ id: PSYCH_ID });
  prismaMock.pacientes.findUnique.mockResolvedValue({ id: PATIENT_ID, psicologo_id: null });
  prismaMock.citas.findFirst.mockResolvedValue(null);
});

describe("createAppointment", () => {
  it("infiere el psicólogo de la sesión y marca la primera visita como consulta inicial", async () => {
    prismaMock.citas.count.mockResolvedValue(0);
    prismaMock.citas.create.mockResolvedValue(appointmentRow({ tipo_sesion: "CONSULTA_INICIAL" }));

    const result = await createAppointment(psychologist, {
      patientId: PATIENT_ID,
      startTime: START,
      durationMinutes: 60,
      modality: AppointmentModality.IN_PERSON,
    });

    const { data } = lastCallArg(prismaMock.citas.create) as { data: Record<string, unknown> };

    expect(data).toMatchObject({
      psicologo_id: PSYCH_ID,
      paciente_id: PATIENT_ID,
      estado: "PENDIENTE",
      tipo_sesion: "CONSULTA_INICIAL",
      // Adulto, presencial y sin recargo de mismo día (la cita es futura).
      precio: 800,
    });
    expect(result.id).toBe(APPOINTMENT_ID);
  });

  it("marca como sesión individual cuando el paciente ya tenía citas", async () => {
    prismaMock.citas.count.mockResolvedValue(2);
    prismaMock.citas.create.mockResolvedValue(appointmentRow());

    await createAppointment(psychologist, {
      patientId: PATIENT_ID,
      startTime: START,
      durationMinutes: 45,
      modality: AppointmentModality.IN_PERSON,
    });

    const { data } = lastCallArg(prismaMock.citas.create) as { data: Record<string, unknown> };

    expect(data).toMatchObject({ tipo_sesion: "INDIVIDUAL" });
  });

  it("rechaza con 409 cuando el psicólogo ya tiene una cita en ese horario", async () => {
    prismaMock.citas.count.mockResolvedValue(0);
    prismaMock.citas.findFirst.mockResolvedValueOnce({ id: "otra-cita" });

    await expect(
      createAppointment(psychologist, {
        patientId: PATIENT_ID,
        startTime: START,
        durationMinutes: 60,
        modality: AppointmentModality.IN_PERSON,
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.citas.create).not.toHaveBeenCalled();
  });

  it("hereda el psicólogo del paciente cuando quien agenda es el propio paciente", async () => {
    prismaMock.pacientes.findUnique.mockResolvedValue({ id: PATIENT_ID, psicologo_id: PSYCH_ID });
    prismaMock.citas.count.mockResolvedValue(0);
    prismaMock.citas.create.mockResolvedValue(appointmentRow());

    await createAppointment(patient, {
      patientId: PATIENT_ID,
      startTime: START,
      durationMinutes: 60,
      modality: AppointmentModality.IN_PERSON,
    });

    const { data } = lastCallArg(prismaMock.citas.create) as { data: Record<string, unknown> };

    expect(data).toMatchObject({ psicologo_id: PSYCH_ID });
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

    expect(prismaMock.citas.create).not.toHaveBeenCalled();
  });

  it("crea el honorario pendiente con el precio calculado", async () => {
    prismaMock.citas.count.mockResolvedValue(0);
    prismaMock.citas.create.mockResolvedValue(
      appointmentRow({ pagos_honorarios: paymentRow({ monto: "800" }) }),
    );

    const result = await createAppointment(psychologist, {
      patientId: PATIENT_ID,
      startTime: START,
      durationMinutes: 60,
      modality: AppointmentModality.IN_PERSON,
    });

    const { data } = lastCallArg(prismaMock.citas.create) as {
      data: { pagos_honorarios?: { create?: Record<string, unknown> } };
    };

    expect(data.pagos_honorarios?.create).toMatchObject({
      monto: 800,
      estado: "PENDIENTE",
    });
    expect(result.payment).toMatchObject({
      appointmentId: APPOINTMENT_ID,
      amount: "800",
      status: PaymentStatus.PENDING,
    });
  });
});

describe("listAppointments", () => {
  it("restringe al paciente a sus propias citas aunque pida otro paciente", async () => {
    prismaMock.citas.findMany.mockResolvedValue([]);

    await listAppointments(patient, { patientId: "99999999-9999-4999-8999-999999999999" });

    const { where } = lastCallArg(prismaMock.citas.findMany) as { where: Record<string, unknown> };

    expect(where).toMatchObject({ paciente_id: PATIENT_ID });
  });

  it("traduce el estado compartido al valor del esquema en los filtros", async () => {
    prismaMock.citas.findMany.mockResolvedValue([]);

    await listAppointments(admin, { status: SharedStatus.CONFIRMED });

    const { where } = lastCallArg(prismaMock.citas.findMany) as { where: Record<string, unknown> };

    expect(where).toMatchObject({ estado: "CONFIRMADA" });
  });
});

describe("getAppointmentById", () => {
  it("devuelve 404 si la cita no existe", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(null);

    await expect(getAppointmentById(APPOINTMENT_ID, admin)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("impide que un paciente vea una cita ajena", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(appointmentRow({ paciente_id: "otro-paciente" }));

    await expect(getAppointmentById(APPOINTMENT_ID, patient)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("deriva la asistencia y traduce los enums al formato de la interfaz", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(appointmentRow({ estado: "COMPLETADA" }));

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
    prismaMock.citas.findUnique.mockResolvedValue(appointmentRow());

    await expect(
      updateAppointment(patient, APPOINTMENT_ID, { reason: "otro" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("recalcula el fin cuando cambia la hora de inicio", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(appointmentRow());
    prismaMock.citas.update.mockResolvedValue(
      appointmentRow({ inicio: new Date("2030-01-01T12:00:00.000Z"), fin: new Date("2030-01-01T13:00:00.000Z") }),
    );

    await updateAppointment(psychologist, APPOINTMENT_ID, {
      startTime: new Date("2030-01-01T12:00:00.000Z"),
    });

    const { data } = lastCallArg(prismaMock.citas.update) as { data: Record<string, unknown> };

    expect(data).toMatchObject({
      inicio: new Date("2030-01-01T12:00:00.000Z"),
      fin: new Date("2030-01-01T13:00:00.000Z"),
    });
  });
});

describe("changeAppointmentStatus", () => {
  it("traduce el estado compartido al valor persistido", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(appointmentRow());
    prismaMock.citas.update.mockResolvedValue(appointmentRow({ estado: "NO_ASISTIO" }));

    const result = await changeAppointmentStatus(psychologist, APPOINTMENT_ID, SharedStatus.NO_SHOW);

    const { data } = lastCallArg(prismaMock.citas.update) as { data: Record<string, unknown> };

    expect(data).toEqual({ estado: "NO_ASISTIO" });
    expect(result.status).toBe(SharedStatus.NO_SHOW);
  });
});

describe("cancelAppointment", () => {
  it("verifica que el paciente cancele su propia cita y deja el motivo", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(appointmentRow({ paciente_id: PATIENT_ID }));
    prismaMock.citas.update.mockResolvedValue(appointmentRow({ estado: "CANCELADA" }));

    await cancelAppointment(patient, APPOINTMENT_ID, "Me surgió un imprevisto");

    const { data } = lastCallArg(prismaMock.citas.update) as { data: Record<string, unknown> };

    expect(data).toMatchObject({
      estado: "CANCELADA",
      motivo_cancelacion: "Me surgió un imprevisto",
      cancelada_por_id: PATIENT_USER_ID,
    });
    expect(data.cancelada_en).toBeInstanceOf(Date);
  });

  it("elimina el honorario para no dejar una deuda colgando", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(appointmentRow({ paciente_id: PATIENT_ID }));
    prismaMock.citas.update.mockResolvedValue(appointmentRow({ estado: "CANCELADA" }));

    await cancelAppointment(patient, APPOINTMENT_ID, "Me surgió un imprevisto");

    expect(prismaMock.pagos_honorarios.deleteMany).toHaveBeenCalledWith({
      where: { cita_id: APPOINTMENT_ID },
    });
  });

  it("rechaza cancelar una cita ya cancelada", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(appointmentRow({ estado: "CANCELADA" }));

    await expect(cancelAppointment(admin, APPOINTMENT_ID, "motivo")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(prismaMock.citas.update).not.toHaveBeenCalled();
    expect(prismaMock.pagos_honorarios.deleteMany).not.toHaveBeenCalled();
  });
});

describe("updateAppointmentPayment", () => {
  it("marca el honorario como pagado con su fecha de cobro", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(
      appointmentRow({ estado: "COMPLETADA", pagos_honorarios: paymentRow() }),
    );
    prismaMock.citas.findUniqueOrThrow.mockResolvedValue(
      appointmentRow({
        estado: "COMPLETADA",
        pagos_honorarios: paymentRow({ estado: "PAGADO", pagado_en: START }),
      }),
    );

    const result = await updateAppointmentPayment(psychologist, APPOINTMENT_ID, PaymentStatus.PAID);

    const { data } = lastCallArg(prismaMock.pagos_honorarios.update) as {
      data: Record<string, unknown>;
    };

    expect(data.estado).toBe("PAGADO");
    expect(data.pagado_en).toBeInstanceOf(Date);
    expect(result.payment?.status).toBe(PaymentStatus.PAID);
  });

  it("condona el honorario sin fecha de cobro", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(
      appointmentRow({ estado: "COMPLETADA", pagos_honorarios: paymentRow() }),
    );
    prismaMock.citas.findUniqueOrThrow.mockResolvedValue(
      appointmentRow({
        estado: "COMPLETADA",
        pagos_honorarios: paymentRow({ estado: "CONDONADO" }),
      }),
    );

    const result = await updateAppointmentPayment(psychologist, APPOINTMENT_ID, PaymentStatus.WAIVED);

    const { data } = lastCallArg(prismaMock.pagos_honorarios.update) as {
      data: Record<string, unknown>;
    };

    expect(data.estado).toBe("CONDONADO");
    expect(data.pagado_en).toBeNull();
    expect(result.payment?.status).toBe(PaymentStatus.WAIVED);
  });

  it("crea el honorario cuando la cita es anterior a la tabla de pagos", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(
      appointmentRow({ estado: "COMPLETADA", precio: 800, pagos_honorarios: null }),
    );
    prismaMock.citas.findUniqueOrThrow.mockResolvedValue(
      appointmentRow({
        estado: "COMPLETADA",
        precio: 800,
        pagos_honorarios: paymentRow({ estado: "PAGADO", pagado_en: START }),
      }),
    );

    await updateAppointmentPayment(psychologist, APPOINTMENT_ID, PaymentStatus.PAID);

    const { data } = lastCallArg(prismaMock.pagos_honorarios.create) as {
      data: Record<string, unknown>;
    };

    expect(data).toMatchObject({
      cita_id: APPOINTMENT_ID,
      monto: 800,
      estado: "PAGADO",
    });
    expect(prismaMock.pagos_honorarios.update).not.toHaveBeenCalled();
  });

  it("impide que un paciente toque el estado de pago", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(
      appointmentRow({ paciente_id: PATIENT_ID, pagos_honorarios: paymentRow() }),
    );

    await expect(
      updateAppointmentPayment(patient, APPOINTMENT_ID, PaymentStatus.PAID),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(prismaMock.pagos_honorarios.update).not.toHaveBeenCalled();
  });

  it("rechaza cobrar una cita cancelada", async () => {
    prismaMock.citas.findUnique.mockResolvedValue(
      appointmentRow({ estado: "CANCELADA", pagos_honorarios: paymentRow() }),
    );

    await expect(
      updateAppointmentPayment(psychologist, APPOINTMENT_ID, PaymentStatus.PAID),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(prismaMock.pagos_honorarios.update).not.toHaveBeenCalled();
  });
});

describe("listAppointmentOccupancy", () => {
  const FROM = new Date("2030-01-01T00:00:00.000Z");
  const TO = new Date("2030-05-01T00:00:00.000Z");
  const FIN = new Date(START.getTime() + 50 * 60_000);

  it("devuelve los rangos ocupados del psicólogo asignado al paciente", async () => {
    prismaMock.pacientes.findUnique.mockResolvedValue({
      id: PATIENT_ID,
      psicologo_id: PSYCH_ID,
    });
    prismaMock.citas.findMany.mockResolvedValue([{ inicio: START, fin: FIN }]);

    const result = await listAppointmentOccupancy(patient, { from: FROM, to: TO });

    expect(prismaMock.citas.findMany).toHaveBeenCalledTimes(1);
    const where = lastCallArg(prismaMock.citas.findMany).where as Record<string, unknown>;
    expect(where).toMatchObject({ psicologo_id: PSYCH_ID });
    expect(where.inicio).toMatchObject({ lt: TO });
    expect(where.fin).toMatchObject({ gt: FROM });
    expect(result).toEqual([{ startTime: START, endTime: FIN }]);
  });

  it("el psicólogo consulta su propia agenda", async () => {
    prismaMock.citas.findMany.mockResolvedValue([]);

    await listAppointmentOccupancy(psychologist, { from: FROM, to: TO });

    const where = lastCallArg(prismaMock.citas.findMany).where as Record<string, unknown>;
    expect(where).toMatchObject({ psicologo_id: PSYCH_ID });
  });

  it("un paciente sin psicólogo no consulta la agenda", async () => {
    prismaMock.pacientes.findUnique.mockResolvedValue({ id: PATIENT_ID, psicologo_id: null });

    const result = await listAppointmentOccupancy(patient, { from: FROM, to: TO });

    expect(result).toEqual([]);
    expect(prismaMock.citas.findMany).not.toHaveBeenCalled();
  });

  it("un administrador no tiene agenda propia", async () => {
    const result = await listAppointmentOccupancy(admin, { from: FROM, to: TO });

    expect(result).toEqual([]);
    expect(prismaMock.citas.findMany).not.toHaveBeenCalled();
  });
});
