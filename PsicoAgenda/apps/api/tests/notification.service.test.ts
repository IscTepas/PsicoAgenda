import { beforeEach, describe, expect, it, vi } from "vitest";
import { canal_notificacion, estado_envio, modalidad_cita } from "@/generated/prisma/enums";

const { prismaMock, config, enviarCorreoNotificacion } = vi.hoisted(() => ({
  prismaMock: {
    pacientes: { findUnique: vi.fn() },
    psicologos: { findUnique: vi.fn() },
    notificaciones: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
  config: { n8nWhatsappWebhookUrl: "", n8nWebhookSecret: "" },
  enviarCorreoNotificacion: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, disconnectPrisma: vi.fn() }));
vi.mock("@/config", () => ({ config }));
vi.mock("@/services/mailer.service", () => ({ enviarCorreoNotificacion }));

const { canalesDelEvento, despacharPendientes, notificar, redactar } = await import(
  "@/services/notification.service"
);

const { SISTEMA, CORREO, WHATSAPP } = canal_notificacion;
const HORA = 3600_000;

const usuario = (id: string, nombre: string) => ({
  id,
  correo: `${id}@ejemplo.com`,
  nombre_completo: nombre,
  telefono: "3111234567",
  notificar_correo: true,
  notificar_whatsapp: true,
  zona_horaria: "America/Mexico_City",
});

const PACIENTE = usuario("u-paciente", "Ana López");
const PSICOLOGA = usuario("u-psicologa", "Dra. Ruiz");

const aviso = (inicio = new Date(Date.now() + 72 * HORA)) => ({
  citaId: "cita-1",
  pacienteId: "p-1",
  psicologoId: "s-1",
  inicio,
  duracionMinutos: 50,
  modalidad: modalidad_cita.PRESENCIAL,
});

interface Fila {
  canal: canal_notificacion;
  usuario_id: string;
  tipo: string;
  programada_para: Date;
}

const filasCreadas = (): Fila[] =>
  prismaMock.notificaciones.createMany.mock.calls.flatMap((call) => (call[0] as { data: Fila[] }).data);

beforeEach(() => {
  vi.clearAllMocks();
  config.n8nWhatsappWebhookUrl = "";
  prismaMock.pacientes.findUnique.mockResolvedValue({ usuarios: PACIENTE });
  prismaMock.psicologos.findUnique.mockResolvedValue({ usuarios: PSICOLOGA });
  prismaMock.notificaciones.findMany.mockResolvedValue([]);
  prismaMock.notificaciones.updateMany.mockResolvedValue({ count: 1 });
});

describe("canalesDelEvento", () => {
  it("la solicitud rechazada va por sistema, correo y WhatsApp", () => {
    expect(canalesDelEvento("SOLICITUD_RECHAZADA", aviso(), PACIENTE)).toEqual([SISTEMA, CORREO, WHATSAPP]);
  });

  it("respeta las preferencias: sin correo ni WhatsApp queda solo el sistema", () => {
    const sinAvisos = { ...PACIENTE, notificar_correo: false, notificar_whatsapp: false };
    expect(canalesDelEvento("SOLICITUD_ACEPTADA", aviso(), sinAvisos)).toEqual([SISTEMA]);
  });

  it("no manda WhatsApp si no hay teléfono", () => {
    expect(canalesDelEvento("CITA_AGENDADA", aviso(), { ...PACIENTE, telefono: null })).toEqual([
      SISTEMA,
      CORREO,
    ]);
  });

  it("una modificación solo va por WhatsApp si cambió el horario", () => {
    expect(canalesDelEvento("CITA_MODIFICADA", aviso(), PACIENTE)).toEqual([SISTEMA, CORREO]);
    expect(canalesDelEvento("CITA_MODIFICADA", { ...aviso(), cambioHorario: true }, PACIENTE)).toEqual([
      SISTEMA,
      CORREO,
      WHATSAPP,
    ]);
  });
});

describe("redactar", () => {
  it("usa la zona horaria del destinatario y nombra a la contraparte", () => {
    const { asunto, mensaje } = redactar(
      "SOLICITUD_ACEPTADA",
      aviso(new Date("2026-11-03T16:00:00Z")),
      { zona_horaria: "America/Mexico_City" },
      "Dra. Ruiz",
    );
    expect(asunto).toBe("Tu cita fue confirmada");
    expect(mensaje).toContain("Dra. Ruiz");
    expect(mensaje).toContain("10:00");
  });
});

describe("notificar", () => {
  it("los tutores de un menor reciben sus avisos; uno sin canales activos no recibe mensajes", async () => {
    const MAMA = usuario("u-mama", "Mamá");
    const PAPA = { ...usuario("u-papa", "Papá"), notificar_correo: false, notificar_whatsapp: false };
    prismaMock.pacientes.findUnique.mockResolvedValue({
      usuarios: PACIENTE,
      fecha_nacimiento: new Date(Date.now() - 10 * 365 * 24 * HORA),
      pacientes_tutores: [{ tutores: { usuarios: MAMA } }, { tutores: { usuarios: PAPA } }],
    });

    await notificar("CITA_CANCELADA_POR_PSICOLOGO", aviso());

    const canalesDe = (id: string) => filasCreadas().filter((f) => f.usuario_id === id).map((f) => f.canal);
    expect(canalesDe(PACIENTE.id)).toEqual([SISTEMA, CORREO, WHATSAPP]);
    expect(canalesDe(MAMA.id)).toEqual([SISTEMA, CORREO, WHATSAPP]);
    // Solo el aviso dentro de la app: nada sale por correo ni WhatsApp.
    expect(canalesDe(PAPA.id)).toEqual([SISTEMA]);
  });

  it("si el paciente ya es mayor de edad, sus antiguos tutores no reciben nada", async () => {
    prismaMock.pacientes.findUnique.mockResolvedValue({
      usuarios: PACIENTE,
      fecha_nacimiento: new Date("1990-01-01"),
      pacientes_tutores: [{ tutores: { usuarios: usuario("u-mama", "Mamá") } }],
    });

    await notificar("CITA_CANCELADA_POR_PSICOLOGO", aviso());

    expect(filasCreadas().every((f) => f.usuario_id === PACIENTE.id)).toBe(true);
  });

  it("una solicitud nueva avisa a la psicóloga por sistema y correo", async () => {
    await notificar("SOLICITUD_CREADA", { ...aviso(), citaId: undefined });

    const filas = filasCreadas();
    expect(filas.map((f) => f.canal)).toEqual([SISTEMA, CORREO]);
    expect(filas.every((f) => f.usuario_id === PSICOLOGA.id)).toBe(true);
  });

  it("aceptar programa recordatorios de 24 h (3 canales) y 2 h (WhatsApp)", async () => {
    const inicio = new Date(Date.now() + 72 * HORA);
    await notificar("SOLICITUD_ACEPTADA", aviso(inicio));

    const recordatorios = filasCreadas().filter((f) => f.tipo === "RECORDATORIO");
    expect(recordatorios.map((f) => f.canal)).toEqual([SISTEMA, CORREO, WHATSAPP, WHATSAPP]);
    expect(recordatorios[0]!.programada_para.getTime()).toBe(inicio.getTime() - 24 * HORA);
    expect(recordatorios[3]!.programada_para.getTime()).toBe(inicio.getTime() - 2 * HORA);
  });

  it("no programa recordatorios cuya hora ya pasó", async () => {
    await notificar("SOLICITUD_ACEPTADA", aviso(new Date(Date.now() + 3 * HORA)));

    const recordatorios = filasCreadas().filter((f) => f.tipo === "RECORDATORIO");
    expect(recordatorios.map((f) => f.canal)).toEqual([WHATSAPP]);
  });

  it("cancelar la cita cancela los recordatorios pendientes", async () => {
    await notificar("CITA_CANCELADA_POR_PACIENTE", aviso());

    expect(prismaMock.notificaciones.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { estado: estado_envio.CANCELADA } }),
    );
  });

  it("nunca lanza aunque falle la base", async () => {
    prismaMock.pacientes.findUnique.mockRejectedValueOnce(new Error("sin conexión"));
    vi.spyOn(console, "error").mockImplementationOnce(() => undefined);
    await expect(notificar("SOLICITUD_CREADA", aviso())).resolves.toBeUndefined();
  });
});

describe("despacharPendientes", () => {
  const fila = (canal: canal_notificacion) => ({
    id: `n-${canal}`,
    canal,
    tipo: "CONFIRMACION",
    asunto: "Tu cita fue confirmada",
    mensaje: "Mensaje",
    intentos: 0,
    usuarios: {
      correo: PACIENTE.correo,
      nombre_completo: PACIENTE.nombre_completo,
      telefono: PACIENTE.telefono,
    },
    citas: null,
  });

  const estadosActualizados = () =>
    prismaMock.notificaciones.update.mock.calls.map(
      (call) => (call[0] as { data: { estado: string } }).data.estado,
    );

  it("sin n8n no pide WhatsApp; entrega sistema y correo", async () => {
    prismaMock.notificaciones.findMany.mockResolvedValueOnce([fila(SISTEMA), fila(CORREO)]);

    await despacharPendientes();

    const { where } = prismaMock.notificaciones.findMany.mock.calls[0]![0] as {
      where: { canal: { in: unknown } };
    };
    expect(where.canal.in).toEqual([SISTEMA, CORREO]);
    expect(enviarCorreoNotificacion).toHaveBeenCalledTimes(1);
    expect(estadosActualizados()).toEqual([estado_envio.ENVIADA, estado_envio.ENVIADA]);
  });

  it("una fila que otro barrido ya reclamó no se entrega dos veces", async () => {
    prismaMock.notificaciones.findMany.mockResolvedValue([fila(CORREO)]);
    // El primer reclamo gana; el segundo ve `intentos` ya incrementado y no actualiza nada.
    prismaMock.notificaciones.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    await despacharPendientes();
    await despacharPendientes();

    expect(enviarCorreoNotificacion).toHaveBeenCalledTimes(1);
    expect(estadosActualizados()).toEqual([estado_envio.ENVIADA]);
  });

  it("si el correo falla deja la fila pendiente con el error para reintentar", async () => {
    prismaMock.notificaciones.findMany.mockResolvedValueOnce([fila(CORREO)]);
    enviarCorreoNotificacion.mockRejectedValueOnce(new Error("SMTP caído"));

    await despacharPendientes();

    expect(prismaMock.notificaciones.update).toHaveBeenCalledWith({
      where: { id: "n-CORREO" },
      data: { estado: estado_envio.PENDIENTE, error: "SMTP caído" },
    });
  });

  it("con n8n configurado entrega WhatsApp por el webhook", async () => {
    config.n8nWhatsappWebhookUrl = "https://n8n.ejemplo.com/webhook/whatsapp";
    prismaMock.notificaciones.findMany.mockResolvedValueOnce([fila(WHATSAPP)]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await despacharPendientes();

    expect(fetchMock).toHaveBeenCalledWith(config.n8nWhatsappWebhookUrl, expect.anything());
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body) as {
      telefono: string;
    };
    expect(body.telefono).toBe(PACIENTE.telefono);
    expect(estadosActualizados()).toEqual([estado_envio.ENVIADA]);
    fetchMock.mockRestore();
  });
});
