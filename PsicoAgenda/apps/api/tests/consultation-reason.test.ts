import { beforeEach, describe, expect, it, vi } from "vitest";

const { motivos } = vi.hoisted(() => ({
  motivos: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { motivos_consulta: motivos }, disconnectPrisma: vi.fn() }));

const { Prisma } = await import("@/generated/prisma/client");
const { createReason, deleteReason, listActiveReasons, reasonText, resolveReasons } = await import(
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

describe("resolveReasons", () => {
  const ESTRES = fila({ id: "m-2", codigo: "estres_laboral", etiqueta: "Estrés laboral", orden: 110 });

  it("varios motivos válidos se guardan todos y el texto suelto se descarta", async () => {
    motivos.findMany.mockResolvedValue([fila(), ESTRES]);
    await expect(resolveReasons(db, ["m-1", "m-2", "m-1"], "algo")).resolves.toEqual({
      motivoIds: ["m-1", "m-2"],
      motivo: null,
    });
  });

  it("rechaza si alguno no existe o está inactivo", async () => {
    motivos.findMany.mockResolvedValueOnce([fila()]);
    await expect(resolveReasons(db, ["m-1", "m-x"], undefined)).rejects.toMatchObject({ statusCode: 400 });
    motivos.findMany.mockResolvedValueOnce([fila({ activo: false })]);
    await expect(resolveReasons(db, ["m-1"], undefined)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("«Otro» junto con otros motivos exige texto y lo conserva", async () => {
    motivos.findMany.mockResolvedValue([fila(), OTRO]);
    await expect(resolveReasons(db, ["m-1", "m-otro"], "  ")).rejects.toMatchObject({ statusCode: 400 });
    await expect(resolveReasons(db, ["m-1", "m-otro"], " Insomnio laboral ")).resolves.toEqual({
      motivoIds: ["m-1", "m-otro"],
      motivo: "Insomnio laboral",
    });
  });

  it("sin motivos del catálogo acepta el texto libre (clientes anteriores)", async () => {
    await expect(resolveReasons(db, [], "Texto")).resolves.toEqual({ motivoIds: [], motivo: "Texto" });
    expect(motivos.findMany).not.toHaveBeenCalled();
  });
});

describe("reasonText", () => {
  const enlace = (etiqueta: string, orden: number, requiere_texto = false) => ({
    motivos_consulta: { id: etiqueta, etiqueta, requiere_texto, orden },
  });

  it("una cita histórica sin motivos del catálogo sigue mostrando su texto", () => {
    expect(reasonText("Seguimiento de duelo", [])).toBe("Seguimiento de duelo");
  });

  it("une las etiquetas en el orden del catálogo y pone el texto en lugar de «Otro»", () => {
    expect(reasonText("Miedo a manejar", [enlace("Otro", 999, true), enlace("Insomnio", 50), enlace("Ansiedad", 40)])).toBe(
      "Ansiedad, Insomnio, Miedo a manejar",
    );
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
    expect((motivos.create.mock.calls[0]![0] as { data?: unknown }).data).toMatchObject({ es_otro: true, requiere_texto: true });
  });

  it("no deja borrar un motivo en uso", async () => {
    motivos.delete.mockRejectedValue(errorPrisma("P2003"));
    await expect(deleteReason("m-1")).rejects.toMatchObject({ statusCode: 409 });
  });
});
