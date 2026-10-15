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
    expect(result[0].one).toBe(1);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entity: TEST_ENTITY } });
    await disconnectPrisma();
  });

  it("connects to the database and responds to $queryRaw", async () => {
    const result = await prisma.$queryRaw<{ one: number }[]>`SELECT 1 as one`;
    expect(result).toHaveLength(1);
    expect(result[0].one).toBe(1);
  });

  describe("AuditLog CRUD", () => {
    it("creates a record", async () => {
      const id = randomUUID();

      const created = await prisma.auditLog.create({
        data: {
          id,
          action: "TEST_CREATE",
          entity: TEST_ENTITY,
          detail: { testRunId: TEST_RUN_ID },
        },
      });

      expect(created.id).toBe(id);
      expect(created.action).toBe("TEST_CREATE");
      expect(created.entity).toBe(TEST_ENTITY);
    });

    it("reads a created record", async () => {
      const id = randomUUID();
      await prisma.auditLog.create({
        data: {
          id,
          action: "TEST_READ",
          entity: TEST_ENTITY,
          detail: { testRunId: TEST_RUN_ID },
        },
      });

      const found = await prisma.auditLog.findUnique({ where: { id } });

      expect(found).not.toBeNull();
      expect(found?.action).toBe("TEST_READ");
      expect(found?.entity).toBe(TEST_ENTITY);
    });

    it("updates a record", async () => {
      const id = randomUUID();
      await prisma.auditLog.create({
        data: {
          id,
          action: "TEST_UPDATE_BEFORE",
          entity: TEST_ENTITY,
          detail: { testRunId: TEST_RUN_ID },
        },
      });

      const updated = await prisma.auditLog.update({
        where: { id },
        data: { action: "TEST_UPDATE_AFTER" },
      });

      expect(updated.action).toBe("TEST_UPDATE_AFTER");
    });

    it("deletes a record", async () => {
      const id = randomUUID();
      await prisma.auditLog.create({
        data: {
          id,
          action: "TEST_DELETE",
          entity: TEST_ENTITY,
          detail: { testRunId: TEST_RUN_ID },
        },
      });

      await prisma.auditLog.delete({ where: { id } });
      const found = await prisma.auditLog.findUnique({ where: { id } });

      expect(found).toBeNull();
    });
  });
});
