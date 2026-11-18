import { beforeEach, describe, expect, it, vi } from "vitest";
import { updatePsychologistScheduleSchema } from "@psicoagenda/shared";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    psicologos: { findUnique: vi.fn() },
    horarios_psicologo: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, disconnectPrisma: vi.fn() }));

const { replacePsychologistSchedule } = await import("@/services/psychologist-schedule.service");

const hora = (h: number) => new Date(`1970-01-01T${String(h).padStart(2, "0")}:00:00Z`);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockResolvedValue([]);
  prismaMock.psicologos.findUnique.mockResolvedValue({ id: "psi-1" });
});

describe("replacePsychologistSchedule", () => {
  it("borra el horario anterior y guarda cada franja una sola vez, de una hora", async () => {
    prismaMock.horarios_psicologo.findMany.mockResolvedValue([
      { dia_semana: 6, hora_inicio: hora(10), hora_fin: hora(11) },
    ]);

    const guardado = await replacePsychologistSchedule("psi-1", [
      { dayOfWeek: 6, hour: 10 },
      { dayOfWeek: 6, hour: 10 },
      { dayOfWeek: 7, hour: 9 },
    ]);

    expect(prismaMock.horarios_psicologo.deleteMany).toHaveBeenCalledWith({ where: { psicologo_id: "psi-1" } });
    const { data } = prismaMock.horarios_psicologo.createMany.mock.calls[0]![0] as {
      data: { dia_semana: number; hora_inicio: Date; hora_fin: Date }[];
    };
    expect(data.map((f) => [f.dia_semana, f.hora_inicio.getUTCHours(), f.hora_fin.getUTCHours()])).toEqual([
      [6, 10, 11],
      [7, 9, 10],
    ]);
    expect(guardado.slots).toEqual([{ dayOfWeek: 6, startTime: "10:00", endTime: "11:00" }]);
  });
});

describe("updatePsychologistScheduleSchema", () => {
  it("rechaza un horario vacío y horas fuera del rango de atención", () => {
    expect(updatePsychologistScheduleSchema.safeParse({ slots: [] }).success).toBe(false);
    expect(updatePsychologistScheduleSchema.safeParse({ slots: [{ dayOfWeek: 6, hour: 23 }] }).success).toBe(false);
    expect(updatePsychologistScheduleSchema.safeParse({ slots: [{ dayOfWeek: 8, hour: 10 }] }).success).toBe(false);
    expect(updatePsychologistScheduleSchema.safeParse({ slots: [{ dayOfWeek: 7, hour: 21 }] }).success).toBe(true);
  });
});
