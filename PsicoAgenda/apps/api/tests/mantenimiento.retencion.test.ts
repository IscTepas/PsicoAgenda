import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {}, disconnectPrisma: vi.fn() }));
vi.mock("@/services/codigo-cache.repo", () => ({ limpiarCacheRegistroVencida: vi.fn() }));

const { RETENCION, LOTE_PURGA, MAX_LOTES_PURGA } = await import("@/services/mantenimiento.service");

/**
 * Las ventanas de retención son una decisión de producto y de protección de
 * datos, no un detalle de implementación: si alguien las cambia, la prueba debe
 * obligar a revisar el change y la documentación.
 */
describe("RETENCION", () => {
  it("fija las ventanas acordadas", () => {
    expect(RETENCION).toEqual({
      notificacionesEnviadasDias: 90,
      notificacionesCanceladasDias: 7,
      solicitudesVencidasDias: 30,
      solicitudesTerminalesMeses: 12,
    });
  });

  it("acota el trabajo de cada ejecución", () => {
    expect(LOTE_PURGA).toBe(1_000);
    expect(MAX_LOTES_PURGA).toBe(10);
  });
});
