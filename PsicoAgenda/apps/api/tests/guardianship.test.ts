import { UserRole } from "@psicoagenda/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { db } = vi.hoisted(() => {
  const tabla = () => ({
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  });
  const db = {
    pacientes: tabla(),
    pacientes_tutores: tabla(),
    tutores: tabla(),
    usuarios: tabla(),
    consentimientos_informados: tabla(),
    registros_auditoria: tabla(),
    notificaciones: tabla(),
    $transaction: vi.fn(),
  };
  return { db };
});
vi.mock("@/lib/prisma", () => ({ prisma: db, disconnectPrisma: vi.fn() }));

const {
  addGuardian,
  assertCanActOnPatient,
  finalizarTutelasVencidas,
  isMinorOn,
  removeGuardian,
} = await import("@/services/guardianship.service");
const { requirePatientAccess } = await import("@/services/clinical-record.service");

const yo = (role: UserRole, id = "u-tutor") => ({ id, role, email: `${id}@x.com` }) as never;
const hace = (anios: number, dias = 0) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - anios);
  d.setUTCDate(d.getUTCDate() - dias);
  return d;
};

const paciente = (over: Record<string, unknown> = {}) => ({
  usuario_id: "u-menor",
  fecha_nacimiento: hace(12),
  psicologos: { usuario_id: "u-psico" },
  pacientes_tutores: [{ tutor_id: "t-1" }],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  // Las transacciones interactivas reciben el mismo doble; las de arreglo se resuelven tal cual.
  db.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === "function" ? (arg as (tx: typeof db) => unknown)(db) : Promise.all(arg as unknown[]),
  );
  db.pacientes_tutores.findMany.mockResolvedValue([]);
});

describe("isMinorOn", () => {
  it("deja de ser menor el día que cumple 18", () => {
    expect(isMinorOn(hace(18, -1))).toBe(true);
    expect(isMinorOn(hace(18))).toBe(false);
    expect(isMinorOn(null)).toBe(false);
  });
});

describe("assertCanActOnPatient", () => {
  it("el propio paciente, su tutor, su psicólogo y administración pueden", async () => {
    db.pacientes.findUnique.mockResolvedValue(paciente());
    await expect(assertCanActOnPatient(yo(UserRole.PATIENT, "u-menor"), "p-1")).resolves.toBeUndefined();
    await expect(assertCanActOnPatient(yo(UserRole.PATIENT), "p-1")).resolves.toBeUndefined();
    await expect(assertCanActOnPatient(yo(UserRole.PSYCHOLOGIST, "u-psico"), "p-1")).resolves.toBeUndefined();
    await expect(assertCanActOnPatient(yo(UserRole.ADMIN, "u-admin"), "p-1")).resolves.toBeUndefined();
  });

  it("un tercero y otro psicólogo no pueden", async () => {
    db.pacientes.findUnique.mockResolvedValue(paciente({ pacientes_tutores: [] }));
    await expect(assertCanActOnPatient(yo(UserRole.PATIENT, "u-otro"), "p-1")).rejects.toMatchObject({ statusCode: 403 });
    await expect(assertCanActOnPatient(yo(UserRole.PSYCHOLOGIST, "u-otra"), "p-1")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("el vínculo deja de autorizar en cuanto el paciente cumple 18, aunque la fila siga", async () => {
    db.pacientes.findUnique.mockResolvedValue(paciente({ fecha_nacimiento: hace(18) }));
    await expect(assertCanActOnPatient(yo(UserRole.PATIENT), "p-1")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("tras la mayoría de edad el paciente se gestiona solo", async () => {
    db.pacientes.findUnique.mockResolvedValue(paciente({ fecha_nacimiento: hace(18), pacientes_tutores: [] }));
    await expect(assertCanActOnPatient(yo(UserRole.PATIENT, "u-menor"), "p-1")).resolves.toBeUndefined();
  });
});

describe("el tutor no ve contenido clínico", () => {
  it("el expediente y la bitácora rechazan a una cuenta PACIENTE", async () => {
    await expect(requirePatientAccess(yo(UserRole.PATIENT), "p-1")).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("addGuardian", () => {
  const psico = yo(UserRole.PSYCHOLOGIST, "u-psico");

  beforeEach(() => {
    db.pacientes.findUnique.mockResolvedValue(paciente());
    db.pacientes.findUniqueOrThrow.mockResolvedValue(paciente());
    db.tutores.upsert.mockResolvedValue({ id: "t-cuenta" });
    db.tutores.create.mockResolvedValue({ id: "t-contacto" });
  });

  it("enlaza una cuenta existente y la deja principal si es la primera", async () => {
    db.usuarios.findUnique.mockResolvedValue({ id: "u-mama", nombre_completo: "Mamá", telefono: null });

    await addGuardian(psico, "p-1", { email: "mama@x.com" });

    expect(db.pacientes_tutores.create).toHaveBeenCalledWith({
      data: { paciente_id: "p-1", tutor_id: "t-cuenta", es_principal: true },
    });
  });

  it("registra un contacto sin cuenta", async () => {
    await addGuardian(psico, "p-1", { name: "Papá", phone: "3111111111" });
    expect(db.tutores.create).toHaveBeenCalled();
    expect(db.pacientes_tutores.create.mock.calls[0]![0].data.tutor_id).toBe("t-contacto");
  });

  it("rechaza al propio paciente y al psicólogo tratante como tutores", async () => {
    db.usuarios.findUnique.mockResolvedValueOnce({ id: "u-menor", nombre_completo: "x", telefono: null });
    await expect(addGuardian(psico, "p-1", { email: "menor@x.com" })).rejects.toMatchObject({ statusCode: 400 });
    db.usuarios.findUnique.mockResolvedValueOnce({ id: "u-psico", nombre_completo: "x", telefono: null });
    await expect(addGuardian(psico, "p-1", { email: "psico@x.com" })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rechaza duplicados", async () => {
    db.usuarios.findUnique.mockResolvedValue({ id: "u-mama", nombre_completo: "Mamá", telefono: null });
    db.pacientes_tutores.findMany.mockResolvedValue([{ tutor_id: "t-cuenta" }]);
    await expect(addGuardian(psico, "p-1", { email: "mama@x.com" })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("no hay tutela sin fecha de nacimiento ni para un adulto", async () => {
    db.pacientes.findUniqueOrThrow.mockResolvedValueOnce(paciente({ fecha_nacimiento: null }));
    await expect(addGuardian(psico, "p-1", { name: "X" })).rejects.toMatchObject({ statusCode: 400 });
    db.pacientes.findUniqueOrThrow.mockResolvedValueOnce(paciente({ fecha_nacimiento: hace(20) }));
    await expect(addGuardian(psico, "p-1", { name: "X" })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("removeGuardian", () => {
  const psico = yo(UserRole.PSYCHOLOGIST, "u-psico");
  beforeEach(() => db.pacientes.findUnique.mockResolvedValue(paciente()));

  it("quitar al principal exige nombrar a otro o confirmar quedarse sin principal", async () => {
    const dos = [
      { tutor_id: "t-1", es_principal: true },
      { tutor_id: "t-2", es_principal: false },
    ];
    // Lo que lee la desvinculación; el listado final usa el [] por defecto.
    db.pacientes_tutores.findMany.mockResolvedValueOnce(dos).mockResolvedValueOnce(dos);

    await expect(removeGuardian(psico, "p-1", "t-1", {})).rejects.toMatchObject({ statusCode: 409 });

    await removeGuardian(psico, "p-1", "t-1", { nuevoPrincipalId: "t-2" });
    expect(db.pacientes_tutores.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { es_principal: true } }),
    );
  });

  it("con confirmación explícita queda sin principal", async () => {
    db.pacientes_tutores.findMany.mockResolvedValueOnce([{ tutor_id: "t-1", es_principal: true }]);
    await removeGuardian(psico, "p-1", "t-1", { sinPrincipal: true });
    expect(db.pacientes_tutores.delete).toHaveBeenCalled();
    expect(db.pacientes_tutores.update).not.toHaveBeenCalled();
  });
});

describe("finalizarTutelasVencidas", () => {
  it("borra todos los vínculos, vence los consentimientos del tutor, audita y avisa según preferencias", async () => {
    db.pacientes.findMany.mockResolvedValueOnce([
      {
        id: "p-1",
        usuarios: { id: "u-menor", nombre_completo: "Ana", notificar_correo: true },
        pacientes_tutores: [
          { tutor_id: "t-1", tutores: { usuarios: { id: "u-mama", notificar_correo: true } } },
          { tutor_id: "t-2", tutores: { usuarios: { id: "u-papa", notificar_correo: false } } },
          { tutor_id: "t-3", tutores: { usuarios: null } },
        ],
      },
    ]);

    expect(await finalizarTutelasVencidas()).toBe(1);

    expect(db.pacientes_tutores.deleteMany).toHaveBeenCalledWith({ where: { paciente_id: "p-1" } });
    expect(db.consentimientos_informados.updateMany.mock.calls[0]![0]).toMatchObject({
      data: { estado: "VENCIDO" },
    });
    expect(db.registros_auditoria.create.mock.calls[0]![0].data).toMatchObject({
      accion: "TUTELA_FINALIZADA",
      detalle: { tutores: ["t-1", "t-2", "t-3"] },
    });
    const avisos = db.notificaciones.createMany.mock.calls[0]![0].data as { usuario_id: string; canal: string }[];
    const de = (id: string) => avisos.filter((a) => a.usuario_id === id).map((a) => a.canal);
    expect(de("u-menor")).toEqual(["SISTEMA", "CORREO"]);
    expect(de("u-mama")).toEqual(["SISTEMA", "CORREO"]);
    expect(de("u-papa")).toEqual(["SISTEMA"]); // sin correo activo: nada sale de la app
  });

  it("es idempotente: sin vínculos pendientes no hace nada", async () => {
    db.pacientes.findMany.mockResolvedValueOnce([]);
    expect(await finalizarTutelasVencidas()).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
