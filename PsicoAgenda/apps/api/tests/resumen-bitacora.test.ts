import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => ({
  db: {
    psicologos: { findMany: vi.fn() },
    notificaciones: { findFirst: vi.fn(), create: vi.fn() },
    citas: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db, disconnectPrisma: vi.fn() }));

const { encolarResumenBitacora, ASUNTO_RESUMEN } = await import("@/services/resumen-bitacora.service");

const psicologa = { id: "psi-1", usuarios: { id: "u-psi", zona_horaria: "America/Mazatlan" } };
const cita = (estado: string, nombre: string, hora: string) => ({
  inicio: new Date(`2026-11-18T${hora}:00-07:00`),
  estado,
  pacientes: { usuarios: { nombre_completo: nombre } },
});

beforeEach(() => {
  vi.clearAllMocks();
  db.psicologos.findMany.mockResolvedValue([psicologa]);
  db.notificaciones.findFirst.mockResolvedValue(null);
});

describe("encolarResumenBitacora", () => {
  it("encola un solo correo con lo que falta cerrar y lo que falta de bitácora, sin datos clínicos", async () => {
    db.citas.findMany.mockResolvedValue([
      cita("CONFIRMADA", "Ana", "10:00"),
      cita("COMPLETADA", "Luis", "12:00"),
    ]);

    expect(await encolarResumenBitacora(new Date("2026-11-18T20:00:00-07:00"))).toBe(1);

    const { data } = db.notificaciones.create.mock.calls[0]![0];
    expect(data).toMatchObject({ usuario_id: "u-psi", canal: "CORREO", asunto: ASUNTO_RESUMEN });
    expect(data.mensaje).toContain("Sin cerrar");
    expect(data.mensaje).toContain("Ana");
    expect(data.mensaje).toContain("Sin bitácora");
    expect(data.mensaje).toContain("Luis");
  });

  it("sin pendientes no manda nada, y no repite si ya se encoló hoy", async () => {
    db.citas.findMany.mockResolvedValue([]);
    expect(await encolarResumenBitacora()).toBe(0);

    db.notificaciones.findFirst.mockResolvedValue({ id: "ya" });
    db.citas.findMany.mockResolvedValue([cita("CONFIRMADA", "Ana", "10:00")]);
    expect(await encolarResumenBitacora()).toBe(0);
    expect(db.notificaciones.create).not.toHaveBeenCalled();
  });
});
