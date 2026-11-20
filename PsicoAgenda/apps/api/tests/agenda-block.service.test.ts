import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  UserRole,
  agendaBlockListQuerySchema,
  createAgendaBlockSchema,
} from "@psicoagenda/shared";

const { prismaMock, patientIdsForUser } = vi.hoisted(() => {
  const bloqueos_agenda = {
    create: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  };
  const psicologos = { findUnique: vi.fn() };
  const pacientes = { findMany: vi.fn() };

  return {
    prismaMock: { bloqueos_agenda, psicologos, pacientes },
    patientIdsForUser: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
  disconnectPrisma: vi.fn(),
}));

vi.mock("@/services/guardianship.service", () => ({ patientIdsForUser }));

const { createAgendaBlock, deleteAgendaBlock, listAgendaBlocks } = await import(
  "@/services/agenda-block.service"
);
const { assertNoAgendaBlock } = await import("@/services/agenda-block.guard");

const PSYCH_USER_ID = "11111111-1111-4111-8111-111111111111";
const PSYCH_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PSYCH_ID = "99999999-9999-4999-8999-999999999999";
const PATIENT_USER_ID = "33333333-3333-4333-8333-333333333333";
const PATIENT_ID = "44444444-4444-4444-8444-444444444444";
const BLOCK_ID = "55555555-5555-4555-8555-555555555555";

const START = new Date("2030-01-10T14:00:00.000Z");
const END = new Date("2030-01-10T16:00:00.000Z");

const psychologist = {
  id: PSYCH_USER_ID,
  email: "psi@psicoagenda.test",
  role: UserRole.PSYCHOLOGIST,
};
const patient = {
  id: PATIENT_USER_ID,
  email: "pac@psicoagenda.test",
  role: UserRole.PATIENT,
};
const admin = {
  id: "66666666-6666-4666-8666-666666666666",
  email: "admin@psicoagenda.test",
  role: UserRole.ADMIN,
};

function blockRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BLOCK_ID,
    psicologo_id: PSYCH_ID,
    fecha_inicio: START,
    fecha_fin: END,
    todo_el_dia: false,
    motivo: "Congreso",
    creado_en: START,
    actualizado_en: START,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.psicologos.findUnique.mockResolvedValue({ id: PSYCH_ID });
  prismaMock.bloqueos_agenda.findMany.mockResolvedValue([]);
});

describe("esquemas de bloqueo", () => {
  it("rechaza un fin anterior o igual al inicio", () => {
    expect(
      createAgendaBlockSchema.safeParse({ startTime: END, endTime: END }).success,
    ).toBe(false);
    expect(
      createAgendaBlockSchema.safeParse({ startTime: END, endTime: START }).success,
    ).toBe(false);
  });

  it("rechaza un motivo de más de 100 caracteres", () => {
    const result = createAgendaBlockSchema.safeParse({
      startTime: START,
      endTime: END,
      reason: "x".repeat(101),
    });

    expect(result.success).toBe(false);
  });

  it("acepta el rango con from/to o con sus alias startDate/endDate", () => {
    expect(
      agendaBlockListQuerySchema.safeParse({ from: START, to: END }).success,
    ).toBe(true);
    expect(
      agendaBlockListQuerySchema.safeParse({ startDate: START, endDate: END }).success,
    ).toBe(true);
  });

  it("exige un rango de fechas", () => {
    expect(agendaBlockListQuerySchema.safeParse({}).success).toBe(false);
  });
});

describe("createAgendaBlock", () => {
  const input = {
    startTime: START,
    endTime: END,
    allDay: false,
    reason: "  Congreso  ",
  };

  it("toma el psicólogo de la sesión y normaliza el motivo", async () => {
    prismaMock.bloqueos_agenda.create.mockResolvedValue(blockRow());

    const result = await createAgendaBlock(psychologist, input);

    const { data } = prismaMock.bloqueos_agenda.create.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };

    expect(data).toMatchObject({
      psicologo_id: PSYCH_ID,
      fecha_inicio: START,
      fecha_fin: END,
      motivo: "Congreso",
    });
    expect(result).toMatchObject({ psychologistId: PSYCH_ID, reason: "Congreso" });
  });

  it("solo permite bloquear al psicólogo", async () => {
    await expect(createAgendaBlock(patient, input)).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(prismaMock.bloqueos_agenda.create).not.toHaveBeenCalled();
  });

  it("traduce el EXCLUDE de solape a un 409 legible", async () => {
    prismaMock.bloqueos_agenda.create.mockRejectedValue(
      new Error('conflicting key value violates exclusion constraint "excl_bloqueos_sin_empalme"'),
    );

    await expect(createAgendaBlock(psychologist, input)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("listAgendaBlocks", () => {
  it("acota al psicólogo de la sesión", async () => {
    await listAgendaBlocks(psychologist, { from: START, to: END });

    const { where } = prismaMock.bloqueos_agenda.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };

    expect(where).toMatchObject({ psicologo_id: PSYCH_ID });
  });

  it("el paciente ve los bloqueos del psicólogo que lo atiende", async () => {
    patientIdsForUser.mockResolvedValue([PATIENT_ID]);
    prismaMock.pacientes.findMany.mockResolvedValue([{ psicologo_id: PSYCH_ID }]);

    await listAgendaBlocks(patient, { startDate: START, endDate: END });

    const { where } = prismaMock.bloqueos_agenda.findMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };

    expect(where).toMatchObject({ psicologo_id: { in: [PSYCH_ID] } });
  });

  it("el administrador debe indicar el psicólogo", async () => {
    await expect(listAgendaBlocks(admin, { from: START, to: END })).rejects.toMatchObject({
      statusCode: 400,
    });

    expect(prismaMock.bloqueos_agenda.findMany).not.toHaveBeenCalled();
  });

  it("rechaza un rango invertido", async () => {
    await expect(
      listAgendaBlocks(psychologist, { from: END, to: START }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("deleteAgendaBlock", () => {
  it("elimina el bloqueo propio", async () => {
    prismaMock.bloqueos_agenda.findUnique.mockResolvedValue({ psicologo_id: PSYCH_ID });

    await deleteAgendaBlock(psychologist, BLOCK_ID);

    expect(prismaMock.bloqueos_agenda.delete).toHaveBeenCalledWith({ where: { id: BLOCK_ID } });
  });

  it("no permite eliminar el bloqueo de otro profesional", async () => {
    prismaMock.bloqueos_agenda.findUnique.mockResolvedValue({ psicologo_id: OTHER_PSYCH_ID });

    await expect(deleteAgendaBlock(psychologist, BLOCK_ID)).rejects.toMatchObject({
      statusCode: 403,
    });

    expect(prismaMock.bloqueos_agenda.delete).not.toHaveBeenCalled();
  });

  it("devuelve 404 si el bloqueo no existe", async () => {
    prismaMock.bloqueos_agenda.findUnique.mockResolvedValue(null);

    await expect(deleteAgendaBlock(psychologist, BLOCK_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe("assertNoAgendaBlock", () => {
  const tx = prismaMock as unknown as Parameters<typeof assertNoAgendaBlock>[0];

  it("permite el rango cuando no hay bloqueos", async () => {
    prismaMock.bloqueos_agenda.findFirst.mockResolvedValue(null);

    await expect(
      assertNoAgendaBlock(tx, { psychologistId: PSYCH_ID, start: START, end: END }),
    ).resolves.toBeUndefined();
  });

  it("lanza 409 con los detalles del bloqueo que se cruza", async () => {
    prismaMock.bloqueos_agenda.findFirst.mockResolvedValue({
      id: BLOCK_ID,
      motivo: "Congreso",
      todo_el_dia: true,
    });

    await expect(
      assertNoAgendaBlock(tx, { psychologistId: PSYCH_ID, start: START, end: END }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "AGENDA_BLOQUEADA",
      details: { blockId: BLOCK_ID, allDay: true, reason: "Congreso" },
    });

    expect(prismaMock.bloqueos_agenda.findFirst).toHaveBeenCalledWith({
      where: {
        psicologo_id: PSYCH_ID,
        fecha_inicio: { lt: END },
        fecha_fin: { gt: START },
      },
      select: { id: true, motivo: true, todo_el_dia: true },
    });
  });
});
