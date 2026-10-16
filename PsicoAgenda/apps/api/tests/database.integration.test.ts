import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma, disconnectPrisma } from "@/lib/prisma";

/**
 * Pruebas de integración reales contra la base de datos configurada en DATABASE_URL.
 * No usan mocks: el objetivo es verificar conectividad y operaciones CRUD básicas
 * contra PostgreSQL/Supabase tal como lo haría la API en producción.
 */
const TEST_RUN_ID = randomUUID();
const TEST_ENTITY = `integration_test_${TEST_RUN_ID}`;

describe("database connectivity and CRUD", () => {
  beforeAll(async () => {
    const result = await prisma.$queryRaw<{ one: number }[]>`SELECT 1 as one`;
    expect(result).toHaveLength(1);
    expect(result[0]?.one).toBe(1);
  });

  afterAll(async () => {
    await prisma.registros_auditoria.deleteMany({ where: { entidad: TEST_ENTITY } });
    await disconnectPrisma();
  });

  it("connects to the database and responds to $queryRaw", async () => {
    const result = await prisma.$queryRaw<{ one: number }[]>`SELECT 1 as one`;
    expect(result).toHaveLength(1);
    expect(result[0]?.one).toBe(1);
  });

  describe("registros_auditoria CRUD", () => {
    it("creates a record", async () => {
      const id = randomUUID();

      const created = await prisma.registros_auditoria.create({
        data: {
          id,
          accion: "TEST_CREATE",
          entidad: TEST_ENTITY,
          detalle: { testRunId: TEST_RUN_ID },
        },
      });

      expect(created.id).toBe(id);
      expect(created.accion).toBe("TEST_CREATE");
      expect(created.entidad).toBe(TEST_ENTITY);
    });

    it("reads a created record", async () => {
      const id = randomUUID();
      await prisma.registros_auditoria.create({
        data: {
          id,
          accion: "TEST_READ",
          entidad: TEST_ENTITY,
          detalle: { testRunId: TEST_RUN_ID },
        },
      });

      const found = await prisma.registros_auditoria.findUnique({ where: { id } });

      expect(found).not.toBeNull();
      expect(found?.accion).toBe("TEST_READ");
      expect(found?.entidad).toBe(TEST_ENTITY);
    });

    it("updates a record", async () => {
      const id = randomUUID();
      await prisma.registros_auditoria.create({
        data: {
          id,
          accion: "TEST_UPDATE_BEFORE",
          entidad: TEST_ENTITY,
          detalle: { testRunId: TEST_RUN_ID },
        },
      });

      const updated = await prisma.registros_auditoria.update({
        where: { id },
        data: { accion: "TEST_UPDATE_AFTER" },
      });

      expect(updated.accion).toBe("TEST_UPDATE_AFTER");
    });

    it("deletes a record", async () => {
      const id = randomUUID();
      await prisma.registros_auditoria.create({
        data: {
          id,
          accion: "TEST_DELETE",
          entidad: TEST_ENTITY,
          detalle: { testRunId: TEST_RUN_ID },
        },
      });

      await prisma.registros_auditoria.delete({ where: { id } });
      const found = await prisma.registros_auditoria.findUnique({ where: { id } });

      expect(found).toBeNull();
    });
  });
});
