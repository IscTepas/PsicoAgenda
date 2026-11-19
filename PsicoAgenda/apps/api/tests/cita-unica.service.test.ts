import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@psicoagenda/shared";

const { prismaMock, cache, psicologo } = vi.hoisted(() => {
  const tx = {
    usuarios: { create: vi.fn(), delete: vi.fn() },
    pacientes: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    tutores: { create: vi.fn() },
    pacientes_tutores: { create: vi.fn(), deleteMany: vi.fn(), updateMany: vi.fn() },
    contactos_emergencia: { update: vi.fn(), delete: vi.fn() },
    notificaciones: { updateMany: vi.fn() },
  };
  return {
    prismaMock: {
      ...tx,
      $queryRaw: vi.fn(),
      $transaction: vi.fn((cb: (t: typeof tx) => unknown) => cb(tx)),
    },
    cache: { get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn() },
    psicologo: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, disconnectPrisma: vi.fn() }));
vi.mock("@/services/codigo-cache.repo", () => ({ cacheRegistro: cache }));
vi.mock("@/services/psychologist.service", () => ({ requirePsychologistIdByUser: psicologo }));
vi.mock("@/services/mailer.service", () => ({ enviarCorreoNotificacion: vi.fn() }));
vi.mock("@/config", () => ({ config: { webUrl: "http://localhost:3000" } }));

const { crearPacienteCitaUnica, fusionarInvitacion } = await import("@/services/cita-unica.service");

const auth = { id: "u-psi", email: "psi@ejemplo.com", role: UserRole.PSYCHOLOGIST };
const arg = (mock: { mock: { calls: unknown[][] } }) => mock.mock.calls.at(-1)?.[0] as { data: Record<string, unknown> };

beforeEach(() => {
  vi.clearAllMocks();
  psicologo.mockResolvedValue("psi-1");
  prismaMock.$queryRaw.mockResolvedValue([]);
});

describe("crearPacienteCitaUnica", () => {
  it("crea un paciente sin cuenta, marcado como cita única y con su psicóloga", async () => {
    const r = await crearPacienteCitaUnica(auth, { name: "Ana Pérez", phone: "311-123-4567", email: "Ana@Correo.com", isMinor: false });

    const usuario = arg(prismaMock.usuarios.create).data;
    expect(usuario.correo).toMatch(/^cita-unica-.+@sin-cuenta\.invalid$/);
    expect(usuario).toMatchObject({ correo_contacto: "ana@correo.com", telefono: "311-123-4567", notificar_correo: true, notificar_whatsapp: true });
    expect(arg(prismaMock.pacientes.create).data).toMatchObject({ cita_unica: true, psicologo_id: "psi-1", fecha_nacimiento: null });
    expect(r.name).toBe("Ana Pérez");
  });

  it("sin correo no manda avisos por correo", async () => {
    await crearPacienteCitaUnica(auth, { name: "Ana Pérez", phone: "3111234567", isMinor: false });
    expect(arg(prismaMock.usuarios.create).data).toMatchObject({ correo_contacto: null, notificar_correo: false });
  });

  it("si el teléfono ya es de un paciente, no duplica y dice de quién es", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ id: "p-9", nombre: "Luis Gómez" }]);
    await expect(crearPacienteCitaUnica(auth, { name: "Ana Pérez", phone: "3111234567", isMinor: false })).rejects.toMatchObject({
      statusCode: 409,
      code: "PACIENTE_EXISTENTE",
      details: { patientId: "p-9", name: "Luis Gómez" },
    });
    expect(prismaMock.usuarios.create).not.toHaveBeenCalled();
  });

  it("un menor lleva su fecha y queda ligado a su tutor, cuyo teléfono recibe los avisos", async () => {
    const nacimiento = new Date("2016-05-01");
    await crearPacienteCitaUnica(auth, {
      name: "Leo Pérez",
      isMinor: true,
      birthDate: nacimiento,
      guardian: { name: "Marta Pérez", phone: "3112223344" },
    });
    expect(arg(prismaMock.usuarios.create).data.telefono).toBe("3112223344");
    expect(arg(prismaMock.pacientes.create).data.fecha_nacimiento).toBe(nacimiento);
    expect(arg(prismaMock.tutores.create).data).toMatchObject({ nombre_completo: "Marta Pérez", telefono: "3112223344" });
    expect(arg(prismaMock.pacientes_tutores.create).data).toMatchObject({ es_principal: true });
    // A los menores no se les busca duplicado por teléfono: hermanos comparten el del tutor.
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("fusionarInvitacion", () => {
  const TOKEN = "t".repeat(43);

  it("la cuenta nueva se queda con la ficha de la cita única y el paciente vacío desaparece", async () => {
    cache.get.mockResolvedValue("p-viejo");
    prismaMock.pacientes.findUnique
      .mockResolvedValueOnce({ id: "p-viejo", usuario_id: "u-viejo", cita_unica: true, contactos_emergencia: null })
      .mockResolvedValueOnce({
        id: "p-nuevo",
        fecha_nacimiento: new Date("1990-05-01"),
        sexo: "Femenino",
        direccion: null,
        contactos_emergencia: { id: "ce-nuevo" },
        pacientes_tutores: [],
      });

    await fusionarInvitacion(TOKEN, "u-nuevo");

    expect(prismaMock.contactos_emergencia.update).toHaveBeenCalledWith({ where: { id: "ce-nuevo" }, data: { paciente_id: "p-viejo" } });
    expect(prismaMock.pacientes.delete).toHaveBeenCalledWith({ where: { id: "p-nuevo" } });
    expect(prismaMock.pacientes.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "p-viejo" },
        data: expect.objectContaining({ usuario_id: "u-nuevo", cita_unica: false, sexo: "Femenino" }) as unknown,
      }),
    );
    expect(prismaMock.notificaciones.updateMany).toHaveBeenCalledWith({ where: { usuario_id: "u-viejo" }, data: { usuario_id: "u-nuevo" } });
    expect(prismaMock.usuarios.delete).toHaveBeenCalledWith({ where: { id: "u-viejo" } });
    expect(cache.del).toHaveBeenCalled();
  });

  it("con una invitación vencida no toca nada", async () => {
    cache.get.mockResolvedValue(null);
    await fusionarInvitacion(TOKEN, "u-nuevo");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("si la ficha ya no es de cita única (se usó antes), no la mueve", async () => {
    cache.get.mockResolvedValue("p-viejo");
    prismaMock.pacientes.findUnique.mockResolvedValueOnce({ id: "p-viejo", usuario_id: "u-x", cita_unica: false, contactos_emergencia: null });
    await fusionarInvitacion(TOKEN, "u-nuevo");
    expect(prismaMock.pacientes.update).not.toHaveBeenCalled();
    expect(prismaMock.usuarios.delete).not.toHaveBeenCalled();
  });
});
