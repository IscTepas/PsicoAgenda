import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El tope de lotes es lo que garantiza que el endpoint termine antes del
 * timeout de 30 s de `cron-job.org` y del límite de la función en Vercel.
 * Se verifica con el cliente de Prisma sustituido: no hace falta una base para
 * contar cuántas sentencias se ejecutan.
 */
const { queryRaw, limpiarCacheRegistroVencida } = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  limpiarCacheRegistroVencida: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw }, disconnectPrisma: vi.fn() }));
vi.mock("@/services/codigo-cache.repo", () => ({ limpiarCacheRegistroVencida }));

const { purgarDatosVencidos, LOTE_PURGA, MAX_LOTES_PURGA } = await import(
  "@/services/mantenimiento.service"
);

const texto = (strings: TemplateStringsArray) => strings.join(" ").replace(/\s+/g, " ");

const filas = (cantidad: number) => Array.from({ length: cantidad }, () => ({ id: "fila" }));

beforeEach(() => {
  queryRaw.mockReset();
  limpiarCacheRegistroVencida.mockResolvedValue(0);
});

describe("purgarDatosVencidos: control de lotes", () => {
  it("se detiene en MAX_LOTES_PURGA aunque quede trabajo pendiente", async () => {
    let vueltasNotificaciones = 0;

    queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const sentencia = texto(strings);
      if (sentencia.includes("DELETE FROM notificaciones")) {
        vueltasNotificaciones++;
        return Promise.resolve(filas(LOTE_PURGA));
      }
      if (sentencia.includes("pg_database_size")) return Promise.resolve([{ bytes: 1n }]);
      return Promise.resolve([]);
    });

    const resultado = await purgarDatosVencidos();

    expect(vueltasNotificaciones).toBe(MAX_LOTES_PURGA);
    expect(resultado.eliminadas.notificaciones).toBe(MAX_LOTES_PURGA * LOTE_PURGA);
  });

  it("corta el bucle cuando una vuelta devuelve menos filas que el lote", async () => {
    let vueltasNotificaciones = 0;

    queryRaw.mockImplementation((strings: TemplateStringsArray) => {
      const sentencia = texto(strings);
      if (sentencia.includes("DELETE FROM notificaciones")) {
        vueltasNotificaciones++;
        return Promise.resolve(filas(vueltasNotificaciones === 1 ? LOTE_PURGA : 5));
      }
      if (sentencia.includes("pg_database_size")) return Promise.resolve([{ bytes: 1n }]);
      return Promise.resolve([]);
    });

    const resultado = await purgarDatosVencidos();

    expect(vueltasNotificaciones).toBe(2);
    expect(resultado.eliminadas.notificaciones).toBe(LOTE_PURGA + 5);
  });
});
