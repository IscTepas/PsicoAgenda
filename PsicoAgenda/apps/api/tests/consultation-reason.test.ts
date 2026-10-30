import { beforeEach, describe, expect, it, vi } from "vitest";

const { motivos } = vi.hoisted(() => ({
  motivos: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { motivos_consulta: motivos }, disconnectPrisma: vi.fn() }));

const { Prisma } = await import("@/generated/prisma/client");
const { createReason, deleteReason, listActiveReasons, reasonText, resolveReason } = await import(
  "@/services/consultation-reason.service"
);

const fila = (over: Record<string, unknown> = {}) => ({
  id: "m-1",
  codigo: "ansiedad",
  etiqueta: "Ansiedad",
  categoria: "Ansiedad",
  activo: true,
  orden: 20,
  es_otro: false,
  requiere_texto: false,
  creado_en: new Date(),
  ...over,
});
const OTRO = fila({ id: "m-otro", codigo: "otro", etiqueta: "Otro", categoria: "Otro", es_otro: true, requiere_texto: true });

const errorPrisma = (code: string) =>
  new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "test" });

const db = { motivos_consulta: motivos } as never;

beforeEach(() => vi.clearAllMocks());

describe("resolveReason", () => {
  it("un motivo válido guarda la referencia y descarta el texto suelto", async () => {
    motivos.findUnique.mockResolvedValue(fila());
    await expect(resolveReason(db, "m-1", "algo")).resolves.toEqual({ motivo_id: "m-1", motivo: null });
  });

  it("rechaza un motivo inexistente", async () => {
    motivos.findUnique.mockResolvedValue(null);
    await expect(resolveReason(db, "m-x", undefined)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rechaza un motivo inactivo", async () => {
    motivos.findUnique.mockResolvedValue(fila({ activo: false }));
    await expect(resolveReason(db, "m-1", undefined)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("«Otro» exige texto y lo conserva", async () => {
    motivos.findUnique.mockResolvedValue(OTRO);
    await expect(resolveReason(db, "m-otro", "  ")).rejects.toMatchObject({ statusCode: 400 });
    await expect(resolveReason(db, "m-otro", " Insomnio laboral ")).resolves.toEqual({
      motivo_id: "m-otro",
      motivo: "Insomnio laboral",
    });
  });

  it("sin motivo del catálogo acepta el texto libre (clientes anteriores)", async () => {
    await expect(resolveReason(db, undefined, "Texto")).resolves.toEqual({ motivo_id: null, motivo: "Texto" });
    expect(motivos.findUnique).not.toHaveBeenCalled();
  });
});

describe("reasonText", () => {
  it("una cita histórica sin motivo_id sigue mostrando su texto", () => {
    expect(reasonText("Seguimiento de duelo", null)).toBe("Seguimiento de duelo");
  });
  it("con catálogo muestra la etiqueta; en «Otro», el texto", () => {
    expect(reasonText(null, { etiqueta: "Ansiedad", requiere_texto: false })).toBe("Ansiedad");
    expect(reasonText("Insomnio", { etiqueta: "Otro", requiere_texto: true })).toBe("Insomnio");
  });
});

describe("catálogo", () => {
  it("solo lista activos, agrupados por categoría en orden", async () => {
    motivos.findMany.mockResolvedValue([fila(), fila({ id: "m-2", codigo: "estres", etiqueta: "Estrés" }), OTRO]);

    const grupos = await listActiveReasons();

    expect(motivos.findMany.mock.calls[0]![0]).toMatchObject({ where: { activo: true } });
    expect(grupos.map((g) => g.category)).toEqual(["Ansiedad", "Otro"]);
    expect(grupos[0]!.reasons).toHaveLength(2);
  });

  it("un código duplicado responde 409", async () => {
    motivos.create.mockRejectedValue(errorPrisma("P2002"));
    await expect(createReason({ code: "ansiedad", label: "Ansiedad", category: "Ansiedad" })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it("«Otro» siempre se guarda exigiendo texto", async () => {
    motivos.create.mockResolvedValue(OTRO);
    await createReason({ code: "otro2", label: "Otro", category: "Otro", isOther: true, requiresText: false });
    expect(motivos.create.mock.calls[0]![0].data).toMatchObject({ es_otro: true, requiere_texto: true });
  });

  it("no deja borrar un motivo en uso", async () => {
    motivos.delete.mockRejectedValue(errorPrisma("P2003"));
    await expect(deleteReason("m-1")).rejects.toMatchObject({ statusCode: 409 });
  });
});
