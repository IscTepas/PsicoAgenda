import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma, disconnectPrisma } from "@/lib/prisma";

/**
 * Pruebas de integración reales contra la base de datos configurada en DATABASE_URL.
 * No usan mocks: el objetivo es verificar conectividad y operaciones básicas
 * contra PostgreSQL/Supabase tal como lo haría la API en producción.
 */
const TEST_ENTITY = `integration_test_${randomUUID()}`;

/** Lo que pasa dentro se deshace al final: la auditoría es de solo inserción y no se puede limpiar después. */
class Deshacer extends Error {}
async function enTransaccionQueSeDeshace(fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<void>) {
  await prisma
    .$transaction(async (tx) => {
      await fn(tx);
      throw new Deshacer();
    })
    .catch((e: unknown) => {
      if (!(e instanceof Deshacer)) throw e;
    });
}

describe("database connectivity and CRUD", () => {
  beforeAll(async () => {
    const result = await prisma.$queryRaw<{ one: number }[]>`SELECT 1 as one`;
    expect(result).toHaveLength(1);
    expect(result[0]?.one).toBe(1);
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  it("connects to the database and responds to $queryRaw", async () => {
    const result = await prisma.$queryRaw<{ one: number }[]>`SELECT 1 as one`;
    expect(result).toHaveLength(1);
    expect(result[0]?.one).toBe(1);
  });

  describe("registros_auditoria (solo inserción, NOM-024)", () => {
    it("inserta y lee un registro", async () => {
      await enTransaccionQueSeDeshace(async (tx) => {
        const id = randomUUID();
        await tx.registros_auditoria.create({ data: { id, accion: "TEST_CREATE", entidad: TEST_ENTITY } });
        const found = await tx.registros_auditoria.findUnique({ where: { id } });
        expect(found?.accion).toBe("TEST_CREATE");
      });
    });

    it("rechaza modificar un registro", async () => {
      await enTransaccionQueSeDeshace(async (tx) => {
        const id = randomUUID();
        await tx.registros_auditoria.create({ data: { id, accion: "TEST", entidad: TEST_ENTITY } });
        await expect(tx.registros_auditoria.update({ where: { id }, data: { accion: "OTRA" } })).rejects.toThrow(
          /solo inserción/,
        );
      });
    });

    it("rechaza borrar un registro", async () => {
      await enTransaccionQueSeDeshace(async (tx) => {
        const id = randomUUID();
        await tx.registros_auditoria.create({ data: { id, accion: "TEST", entidad: TEST_ENTITY } });
        await expect(tx.registros_auditoria.delete({ where: { id } })).rejects.toThrow(/solo inserción/);
      });
    });
  });
});
