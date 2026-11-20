import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {}, disconnectPrisma: vi.fn() }));

const { syncTasks } = await import("@/services/task.service");

const tx = {
  tareas_sesion: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
    createMany: vi.fn(),
  },
};

beforeEach(() => vi.clearAllMocks());

describe("syncTasks", () => {
  it("conserva las que siguen, borra las que faltan y solo reporta como nuevas las creadas", async () => {
    tx.tareas_sesion.findMany.mockResolvedValue([
      { id: "t-1", texto: "Respirar", orden: 0 },
      { id: "t-2", texto: "Otra", orden: 1 },
    ]);

    const nuevas = await syncTasks(tx as never, "e-1", "p-1", [
      { id: "t-1", text: " Respirar 5 min " },
      { text: "Escribir diario" },
      { text: "   " },
      // Un id que no es de esta hoja no puede secuestrar la tarea de otra: se crea como nueva.
      { id: "t-ajena", text: "Caminar" },
    ]);

    expect(nuevas).toEqual(["Escribir diario", "Caminar"]);
    expect(tx.tareas_sesion.deleteMany).toHaveBeenCalledWith({
      where: { entrada_id: "e-1", id: { notIn: ["t-1"] } },
    });
    expect(tx.tareas_sesion.update).toHaveBeenCalledWith({
      where: { id: "t-1" },
      data: { texto: "Respirar 5 min", orden: 0 },
    });
    // Las dos nuevas se insertan en una sola consulta.
    expect(tx.tareas_sesion.createMany).toHaveBeenCalledTimes(1);
    expect(tx.tareas_sesion.createMany.mock.calls[0]![0].data).toHaveLength(2);
  });
});
