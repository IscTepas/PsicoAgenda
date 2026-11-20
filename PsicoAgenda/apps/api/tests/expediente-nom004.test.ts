import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@psicoagenda/shared";
import { estado_expediente, estado_nota, tipo_nota } from "@/generated/prisma/enums";

const { db, contrasenaOk } = vi.hoisted(() => {
  const db = {
    pacientes: { findUnique: vi.fn(), update: vi.fn() },
    psicologos: { findUnique: vi.fn() },
    expedientes_clinicos: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn(), update: vi.fn() },
    consentimientos_informados: { findFirst: vi.fn(), findMany: vi.fn() },
    entradas_bitacora: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    revisiones_bitacora: { create: vi.fn() },
    registros_auditoria: { create: vi.fn() },
    citas: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  return { db, contrasenaOk: { valor: true } };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/supabase-admin", () => ({
  esContrasenaActual: vi.fn(async () => contrasenaOk.valor),
  guardarPdfConsentimiento: vi.fn(),
  enlacePdfConsentimiento: vi.fn(),
}));
vi.mock("@/services/task.service", () => ({
  avisarTareas: vi.fn(),
  syncTasks: vi.fn(async () => []),
  toSessionTask: vi.fn(),
}));

const { cerrarNota, crearAclaracion, createLogEntry, updateLogEntry, verificarNota } = await import(
  "@/services/log-entry.service"
);
const { cerrarHistoria, darDeBajaPaciente } = await import("@/services/clinical-record.service");
const { sellar, camposDeNota } = await import("@/lib/sello");

const psicologa = { id: "u-psi", email: "psi@x.com", role: UserRole.PSYCHOLOGIST } as never;
const ctx = { auth: psicologa, ip: "203.0.113.7" };

const nota = (over: Record<string, unknown> = {}) => ({
  id: "n-1",
  expediente_id: "r-1",
  cita_id: null,
  psicologo_id: "psi-1",
  fecha_sesion: new Date("2026-11-10T16:00:00.000Z"),
  notas_sesion: "Sesión sin novedades",
  objetivos_trabajados: null,
  plan_proxima_sesion: null,
  estado_general: null,
  progreso: null,
  version: 1,
  tipo: tipo_nota.EVOLUCION,
  estado: estado_nota.BORRADOR,
  cerrada_en: null,
  cerrada_por_id: null,
  hash: null,
  nota_padre_id: null,
  referido_a: null,
  motivo_referencia: null,
  motivo_egreso: null,
  resumen_egreso: null,
  creado_en: new Date("2026-11-10T17:00:00.000Z"),
  actualizado_en: new Date("2026-11-10T17:00:00.000Z"),
  citas: null,
  psicologos: { usuario_id: "u-psi", cedula_profesional: "1234567", usuarios: { nombre_completo: "Lic. Ana" } },
  expedientes_clinicos: { paciente_id: "p-1" },
  tareas_sesion: [],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  contrasenaOk.valor = true;
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  db.pacientes.findUnique.mockResolvedValue({ id: "p-1", psicologo_id: "psi-1", psicologos: null });
  db.psicologos.findUnique.mockResolvedValue({ id: "psi-1", cedula_profesional: "1234567" });
  db.entradas_bitacora.findMany.mockResolvedValue([nota()]);
  db.consentimientos_informados.findMany.mockResolvedValue([]);
});

describe("sello de integridad", () => {
  it("cambia si cambia una sola letra o la hora", () => {
    const en = new Date("2026-11-10T18:00:00.000Z");
    const base = sellar(camposDeNota(nota()), "1234567", "p-1", en);
    expect(base).toMatch(/^[0-9a-f]{64}$/);
    expect(sellar(camposDeNota(nota({ notas_sesion: "Sesión sin novedadez" })), "1234567", "p-1", en)).not.toBe(base);
    expect(sellar(camposDeNota(nota()), "1234567", "p-1", new Date(en.getTime() + 1))).not.toBe(base);
  });
});

describe("notas de evolución", () => {
  it("no se crean sin consentimiento vigente ni historia cerrada", async () => {
    db.consentimientos_informados.findFirst.mockResolvedValue(null);
    db.expedientes_clinicos.findUnique.mockResolvedValue({ historia_estado: estado_nota.BORRADOR });
    await expect(createLogEntry(psicologa, "p-1", { notes: "Hola" }, ctx)).rejects.toThrow(
      /consentimiento informado firmado y la historia clínica cerrada/,
    );
    expect(db.entradas_bitacora.create).not.toHaveBeenCalled();
  });

  it("con los requisitos se crean como borrador y quedan auditadas", async () => {
    db.consentimientos_informados.findFirst.mockResolvedValue({ id: "c-1" });
    db.expedientes_clinicos.findUnique.mockResolvedValue({ id: "r-1", historia_estado: estado_nota.CERRADA });
    await createLogEntry(psicologa, "p-1", { notes: "Hola" }, ctx);
    expect(db.entradas_bitacora.create.mock.calls[0]?.[0].data).toMatchObject({ tipo: tipo_nota.EVOLUCION });
    expect(db.registros_auditoria.create.mock.calls[0]?.[0].data).toMatchObject({
      accion: "CREAR_NOTA",
      entidad_id: "p-1",
      ip: "203.0.113.7",
      usuario_id: "u-psi",
    });
  });

  it("una nota cerrada no se edita", async () => {
    db.entradas_bitacora.findUnique.mockResolvedValue(nota({ estado: estado_nota.CERRADA }));
    await expect(updateLogEntry(psicologa, "n-1", { notes: "otra cosa" }, ctx)).rejects.toThrow(/aclaratoria/);
    expect(db.entradas_bitacora.update).not.toHaveBeenCalled();
  });

  it("editar un borrador guarda antes la versión anterior", async () => {
    db.entradas_bitacora.findUnique.mockResolvedValue(nota());
    await updateLogEntry(psicologa, "n-1", { notes: "corregida" }, ctx);
    expect(db.revisiones_bitacora.create.mock.calls[0]?.[0].data).toMatchObject({
      entrada_id: "n-1",
      version: 1,
      notas_sesion: "Sesión sin novedades",
    });
  });

  it("cerrar pide la contraseña correcta y sella", async () => {
    db.entradas_bitacora.findUnique.mockResolvedValue(nota());
    contrasenaOk.valor = false;
    await expect(cerrarNota(psicologa, "n-1", "mala", ctx)).rejects.toThrow(/contraseña/);
    expect(db.entradas_bitacora.update).not.toHaveBeenCalled();

    contrasenaOk.valor = true;
    await cerrarNota(psicologa, "n-1", "buena", ctx);
    const data = db.entradas_bitacora.update.mock.calls[0]?.[0].data;
    expect(data.estado).toBe(estado_nota.CERRADA);
    expect(data.hash).toBe(sellar(camposDeNota(nota()), "1234567", "p-1", data.cerrada_en));
  });

  it("cerrar la nota de egreso fija la conservación a 5 años", async () => {
    db.entradas_bitacora.findUnique.mockResolvedValue(nota({ tipo: tipo_nota.EGRESO, motivo_egreso: "Alta" }));
    await cerrarNota(psicologa, "n-1", "buena", ctx);
    const data = db.expedientes_clinicos.update.mock.calls[0]?.[0].data;
    expect(data.estado).toBe(estado_expediente.INACTIVO);
    expect(data.conservar_hasta.getFullYear()).toBe(new Date().getFullYear() + 5);
  });

  it("la aclaratoria cuelga de la nota cerrada sin tocarla y nace sellada", async () => {
    db.entradas_bitacora.findUnique.mockResolvedValue(nota({ estado: estado_nota.CERRADA }));
    await crearAclaracion(psicologa, "n-1", { text: "Fecha correcta: 9 de noviembre", password: "buena" }, ctx);
    expect(db.entradas_bitacora.update).not.toHaveBeenCalled();
    const data = db.entradas_bitacora.create.mock.calls[0]?.[0].data;
    expect(data).toMatchObject({ tipo: tipo_nota.ACLARATORIA, nota_padre_id: "n-1", estado: estado_nota.CERRADA });
    expect(data.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("verificar detecta un cambio en el contenido", async () => {
    const cerrada_en = new Date("2026-11-10T18:00:00.000Z");
    const hash = sellar(camposDeNota(nota()), "1234567", "p-1", cerrada_en);
    db.entradas_bitacora.findUnique.mockResolvedValue(nota({ estado: estado_nota.CERRADA, cerrada_en, hash }));
    expect((await verificarNota(psicologa, "n-1")).valid).toBe(true);
    db.entradas_bitacora.findUnique.mockResolvedValue(
      nota({ estado: estado_nota.CERRADA, cerrada_en, hash, notas_sesion: "alterada" }),
    );
    expect((await verificarNota(psicologa, "n-1")).valid).toBe(false);
  });
});

describe("número de sesión", () => {
  it("solo cuentan las notas de evolución, no interconsultas, egresos ni aclaratorias", async () => {
    const { listLogEntries } = await import("@/services/log-entry.service");
    db.expedientes_clinicos.findUnique.mockResolvedValue({ id: "r-1" });
    const en = (dia: number) => new Date(`2026-11-${String(dia).padStart(2, "0")}T16:00:00.000Z`);
    db.entradas_bitacora.findMany.mockResolvedValue([
      nota({ id: "e1", fecha_sesion: en(1) }),
      nota({ id: "ref", tipo: tipo_nota.INTERCONSULTA, fecha_sesion: en(2) }),
      nota({ id: "acl", tipo: tipo_nota.ACLARATORIA, nota_padre_id: "e1", fecha_sesion: en(3) }),
      nota({ id: "e2", fecha_sesion: en(4) }),
    ]);
    const numero = Object.fromEntries((await listLogEntries(psicologa, "p-1")).map((n) => [n.id, n.sessionNumber]));
    expect(numero).toMatchObject({ e1: 1, e2: 2, ref: 0, acl: 0 });
  });
});

describe("historia clínica y baja", () => {
  it("la historia no se cierra sin motivo, diagnóstico y plan", async () => {
    db.expedientes_clinicos.findUnique.mockResolvedValue({ id: "r-1" });
    db.expedientes_clinicos.findUniqueOrThrow.mockResolvedValue({
      id: "r-1",
      historia_estado: estado_nota.BORRADOR,
      motivo_consulta: "Ansiedad",
      diagnostico: null,
      plan_terapeutico: null,
      examen_mental: null,
    });
    await expect(cerrarHistoria(psicologa, "p-1", "buena", ctx)).rejects.toThrow(/impresión diagnóstica, plan terapéutico/);
  });

  it("la baja no borra: marca al paciente y conserva el expediente 5 años", async () => {
    db.expedientes_clinicos.findUnique.mockResolvedValue({ id: "r-1" });
    db.expedientes_clinicos.findUniqueOrThrow.mockResolvedValue({ id: "r-1" });
    db.expedientes_clinicos.create.mockResolvedValue({});
    await darDeBajaPaciente(psicologa, "p-1", ctx).catch(() => undefined);
    expect(db.pacientes.update.mock.calls[0]?.[0].data.eliminado_en).toBeInstanceOf(Date);
    const data = db.expedientes_clinicos.update.mock.calls[0]?.[0].data;
    expect(data.conservar_hasta.getFullYear()).toBe(new Date().getFullYear() + 5);
    expect(db.registros_auditoria.create.mock.calls[0]?.[0].data.accion).toBe("BAJA_PACIENTE");
  });
});
