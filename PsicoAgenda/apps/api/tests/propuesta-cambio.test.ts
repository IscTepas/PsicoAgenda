import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@psicoagenda/shared";

const { db, insertAppointment, notificar } = vi.hoisted(() => {
  const db = {
    citas: { findUnique: vi.fn(), updateMany: vi.fn() },
    solicitudes_cita: { findUnique: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    pagos_honorarios: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, insertAppointment: vi.fn(), notificar: vi.fn() };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/services/notification.service", () => ({ notificar }));
vi.mock("@/services/guardianship.service", () => ({ assertCanActOnPatient: vi.fn(), patientIdsForUser: vi.fn() }));
vi.mock("@/services/agenda-block.guard", () => ({ assertNoAgendaBlock: vi.fn() }));
vi.mock("@/services/appointment.service", () => ({
  assertNoOverlap: vi.fn(),
  avisoDeCita: vi.fn(() => ({})),
  insertAppointment,
  normalizeOverlapError: (e: unknown) => {
    throw e;
  },
  requirePatientId: vi.fn(),
  requirePsychologistId: vi.fn(async () => "psi-1"),
  resolveSessionType: vi.fn(),
  toAppointment: vi.fn(),
  toSchemaModality: (m: string) => (m === "virtual" ? "VIRTUAL" : "PRESENCIAL"),
  toSharedModality: () => "in_person",
}));

const { proponerCambio, responderPropuesta, acceptAppointmentRequest } = await import("@/services/appointment-request.service");

const psicologa = { id: "u-psi", email: "p@x.com", role: UserRole.PSYCHOLOGIST } as never;
const paciente = { id: "u-pac", email: "c@x.com", role: UserRole.PATIENT } as never;
const futuro = (h: number) => new Date(Date.now() + h * 3_600_000);

const solicitud = (over: Record<string, unknown> = {}) => ({
  id: "s-1",
  paciente_id: "p-1",
  psicologo_id: "psi-1",
  inicio_solicitado: futuro(48),
  duracion_minutos: 50,
  modalidad: "PRESENCIAL",
  motivo: null,
  estado: "PENDIENTE",
  propuesta_por_psicologo: true,
  cita_original_id: "c-1",
  creado_en: new Date(),
  atendida_en: null,
  citas: null,
  cita_original: { inicio: futuro(24) },
  solicitudes_motivos: [],
  pacientes: { id: "p-1", fecha_nacimiento: null },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
});

describe("propuesta de cambio de la psicóloga", () => {
  it("crea la propuesta sin tocar la cita original y avisa al paciente", async () => {
    db.citas.findUnique.mockResolvedValue({
      id: "c-1",
      psicologo_id: "psi-1",
      paciente_id: "p-1",
      estado: "CONFIRMADA",
      inicio: futuro(24),
      fin: futuro(25),
      modalidad: "PRESENCIAL",
      tipo_sesion: "INDIVIDUAL",
      motivo: null,
      citas_motivos: [],
      pacientes: { id: "p-1", fecha_nacimiento: null },
    });
    db.solicitudes_cita.findFirst.mockResolvedValue(null);
    db.solicitudes_cita.create.mockResolvedValue(solicitud());

    const r = await proponerCambio(psicologa, { appointmentId: "c-1", startTime: futuro(48) });

    expect(db.solicitudes_cita.create.mock.calls[0]?.[0].data).toMatchObject({
      propuesta_por_psicologo: true,
      cita_original_id: "c-1",
    });
    expect(db.citas.updateMany).not.toHaveBeenCalled();
    expect(notificar).toHaveBeenCalledWith("CAMBIO_PROPUESTO", expect.anything());
    expect(r.proposedByPsychologist).toBe(true);
  });

  it("aceptar cancela la original y crea la nueva", async () => {
    db.solicitudes_cita.findUnique.mockResolvedValue(solicitud());
    db.solicitudes_cita.updateMany.mockResolvedValue({ count: 1 });
    db.citas.updateMany.mockResolvedValue({ count: 1 });
    db.solicitudes_cita.findUniqueOrThrow.mockResolvedValue(solicitud({ estado: "ACEPTADA" }));

    await responderPropuesta(paciente, "s-1", true);

    expect(db.citas.updateMany.mock.calls[0]?.[0]).toMatchObject({ where: { id: "c-1" }, data: { estado: "CANCELADA" } });
    expect(insertAppointment).toHaveBeenCalledTimes(1);
    expect(notificar).toHaveBeenCalledWith("CAMBIO_ACEPTADO", expect.anything());
  });

  it("rechazar deja la cita original como estaba", async () => {
    db.solicitudes_cita.findUnique.mockResolvedValue(solicitud());
    db.solicitudes_cita.update.mockResolvedValue(solicitud({ estado: "RECHAZADA" }));

    await responderPropuesta(paciente, "s-1", false);

    expect(db.citas.updateMany).not.toHaveBeenCalled();
    expect(insertAppointment).not.toHaveBeenCalled();
    expect(notificar).toHaveBeenCalledWith("CAMBIO_RECHAZADO", expect.anything());
  });

  it("la psicóloga no puede aceptar su propia propuesta", async () => {
    db.solicitudes_cita.findUnique.mockResolvedValue(solicitud());
    await expect(acceptAppointmentRequest(psicologa, "s-1")).rejects.toThrow(/la responde el paciente/);
  });
});
