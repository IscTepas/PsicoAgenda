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
  config: {
    whatsappEnabled: false,
    whatsappPhoneId: "1352051977997191",
    whatsappAccessToken: "token-de-prueba",
    whatsappTemplateName: "psicoagenda_aviso_de_cita",
    whatsappTemplateLanguage: "es_MX",
    whatsappTemplateLanguagePsychologist: "es_MX",
    whatsappTemplateLanguagePatientNotice: "es_MX",
    whatsappTemplateLanguagePatientCancellation: "es_MX",
    whatsappTemplateLanguageReminder: "en",
    whatsappTemplateNamed: false,
    whatsappTemplateNamedPsychologist: false,
    whatsappTemplateNamedPatientNotice: false,
    whatsappTemplateNamedPatientCancellation: false,
    whatsappTemplateNamedReminder: true,
    whatsappApiVersion: "v25.0",
    whatsappTemplateParams: 3,
    whatsappTemplatePsychologist: "psicoagenda_aviso_profesional",
    whatsappTemplatePatientNotice: "psicoagenda_aviso_paciente",
    whatsappTemplatePatientCancellation: "psicoagenda_cancelacion_paciente",
    whatsappTemplateReminder: "psicoagenda_recordatorio",
    whatsappTemplateBody: ["nombre", "mensaje", "fecha_hora"],
    whatsappTemplateBodyPsychologist: ["nombre", "mensaje", "fecha_hora"],
    whatsappTemplateBodyPatientNotice: ["nombre", "mensaje", "fecha_hora"],
    whatsappTemplateBodyPatientCancellation: ["nombre", "mensaje", "fecha_hora"],
    whatsappTemplateBodyReminder: ["nombre", "fecha", "empresa", "tiempohasta"],
  },
  enviarCorreoNotificacion: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock, disconnectPrisma: vi.fn() }));
vi.mock("@/config", () => ({ config }));
vi.mock("@/services/mailer.service", () => ({ enviarCorreoNotificacion }));

const { canalesDelEvento, despacharPendientes, notificar, normalizarTelefonoWhatsapp, redactar } =
  await import("@/services/notification.service");

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
  config.whatsappEnabled = false;
  config.whatsappTemplateParams = 3;
  config.whatsappTemplateBody = ["nombre", "mensaje", "fecha_hora"];
  prismaMock.pacientes.findUnique.mockResolvedValue({ usuarios: PACIENTE });
  prismaMock.psicologos.findUnique.mockResolvedValue({ usuarios: PSICOLOGA });
  prismaMock.notificaciones.findMany.mockResolvedValue([]);
  prismaMock.notificaciones.updateMany.mockResolvedValue({ count: 1 });
});

describe("normalizarTelefonoWhatsapp", () => {
  it("antepone el código de México a los teléfonos locales de 10 dígitos", () => {
    expect(normalizarTelefonoWhatsapp("311 123 4567")).toBe("523111234567");
  });

  it("normaliza el formato visible que guarda el perfil", () => {
    expect(normalizarTelefonoWhatsapp("311-123-4567")).toBe("523111234567");
  });

  it("conserva un teléfono que ya trae código de país", () => {
    expect(normalizarTelefonoWhatsapp("+52 311 123 4567")).toBe("523111234567");
  });

  it("quita el 1 histórico del marcado mexicano", () => {
    expect(normalizarTelefonoWhatsapp("+52 1 311 123 4567")).toBe("523111234567");
  });

  it("devuelve null sin teléfono", () => {
    expect(normalizarTelefonoWhatsapp(null)).toBeNull();
    expect(normalizarTelefonoWhatsapp("")).toBeNull();
  });
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

  it("el aviso de una solicitud guarda a cuál se refiere (para llevar a responderla)", async () => {
    await notificar("SOLICITUD_CREADA", { ...aviso(), citaId: undefined, solicitudId: "s-1" });

    const { data } = prismaMock.notificaciones.createMany.mock.calls[0]![0] as {
      data: { solicitud_id: string | null }[];
    };
    expect(data.length).toBeGreaterThan(0);
    expect(data.every((fila) => fila.solicitud_id === "s-1")).toBe(true);
  });

  it("una solicitud nueva avisa a la psicóloga por sistema, correo y WhatsApp", async () => {
    await notificar("SOLICITUD_CREADA", { ...aviso(), citaId: undefined });

    const filas = filasCreadas();
    expect(filas.map((f) => f.canal)).toEqual([SISTEMA, CORREO, WHATSAPP]);
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
  const fila = (canal: canal_notificacion, telefono: string | null = PACIENTE.telefono) => ({
    id: `n-${canal}`,
    canal,
    tipo: "CONFIRMACION",
    asunto: "Tu cita fue confirmada",
    mensaje: "Mensaje",
    intentos: 0,
    programada_para: new Date("2026-11-02T16:00:00Z"),
    usuarios: {
      correo: PACIENTE.correo,
      nombre_completo: PACIENTE.nombre_completo,
      telefono,
      zona_horaria: PACIENTE.zona_horaria,
    },
    citas: null,
  });

  const estadosActualizados = () =>
    prismaMock.notificaciones.update.mock.calls.map(
      (call) => (call[0] as { data: { estado: string } }).data.estado,
    );

  it("sin WhatsApp configurado no pide WhatsApp; entrega sistema y correo", async () => {
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

  const respuestaWhatsappOk = () =>
    new Response(JSON.stringify({ messages: [{ id: "wamid.HBgTEST==", message_status: "accepted" }] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  it("con WhatsApp configurado entrega por la API con los datos del usuario", async () => {
    config.whatsappEnabled = true;
    prismaMock.notificaciones.findMany.mockResolvedValueOnce([fila(WHATSAPP)]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(respuestaWhatsappOk());

    await despacharPendientes();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v25.0/1352051977997191/messages",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer token-de-prueba",
          "Content-Type": "application/json",
        },
      }),
    );

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body) as {
      messaging_product: string;
      to: string;
      type: string;
      template: {
        name: string;
        language: { code: string };
        components: Array<{ type: string; parameters: Array<{ type: string; text: string }> }>;
      };
    };
    expect(body.messaging_product).toBe("whatsapp");
    expect(body.to).toBe("523111234567");
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("psicoagenda_aviso_de_cita");
    expect(body.template.language.code).toBe("es_MX");
    expect(body.template.components[0]!.parameters.map((parametro) => parametro.text)).toEqual([
      PACIENTE.nombre_completo,
      "Mensaje",
      expect.stringContaining("2026"),
    ]);
    expect(estadosActualizados()).toEqual([estado_envio.ENVIADA]);
    fetchMock.mockRestore();
  });

  it("usa el teléfono de cada destinatario, no un número fijo", async () => {
    config.whatsappEnabled = true;
    prismaMock.notificaciones.findMany.mockResolvedValueOnce([fila(WHATSAPP, "5512345678")]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(respuestaWhatsappOk());

    await despacharPendientes();

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body) as {
      to: string;
    };
    expect(body.to).toBe("525512345678");
    expect(estadosActualizados()).toEqual([estado_envio.ENVIADA]);
    fetchMock.mockRestore();
  });

  it("envía los parámetros del cuerpo que declara la plantilla personalizada", async () => {
    config.whatsappEnabled = true;
    config.whatsappTemplateBody = ["nombre", "fecha", "hora", "modalidad"];
    prismaMock.notificaciones.findMany.mockResolvedValueOnce([
      {
        ...fila(WHATSAPP),
        citas: {
          id: "cita-1",
          inicio: new Date("2026-11-03T16:00:00Z"),
          fin: new Date("2026-11-03T17:00:00Z"),
          modalidad: modalidad_cita.VIRTUAL,
          estado: "CONFIRMADA",
        },
      },
    ]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(respuestaWhatsappOk());

    await despacharPendientes();

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body) as {
      template: { components: Array<{ parameters: Array<{ text: string }> }> };
    };
    const parametros = body.template.components[0]!.parameters.map((parametro) => parametro.text);
    expect(parametros).toHaveLength(4);
    expect(parametros[0]).toBe(PACIENTE.nombre_completo);
    expect(parametros[1]).toContain("2026");
    expect(parametros[2]).toMatch(/\d{1,2}:\d{2}/);
    expect(parametros[3]).toBe("videollamada");
    fetchMock.mockRestore();
  });

  it("usa la lista de campos y el idioma del tipo de plantilla correspondiente", async () => {
    config.whatsappEnabled = true;
    // Un recordatorio resuelve a `whatsappTemplateBodyReminder` = [nombre, fecha, empresa, tiempohasta],
    // a `whatsappTemplateLanguageReminder` = "en" y a `whatsappTemplateNamedReminder` = true
    // (la plantilla usa placeholders con nombre).
    prismaMock.notificaciones.findMany.mockResolvedValueOnce([
      {
        ...fila(WHATSAPP),
        plantilla_whatsapp: "psicoagenda_recordatorio",
        citas: {
          id: "cita-1",
          inicio: new Date(Date.now() + 2 * HORA),
          fin: new Date(Date.now() + 3 * HORA),
          modalidad: modalidad_cita.PRESENCIAL,
          estado: "CONFIRMADA",
        },
      },
    ]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(respuestaWhatsappOk());

    await despacharPendientes();

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body) as {
      template: {
        name: string;
        language: { code: string };
        components: Array<{ parameters: Array<{ type: string; parameter_name: string; text: string }> }>;
      };
    };
    expect(body.template.name).toBe("psicoagenda_recordatorio");
    expect(body.template.language.code).toBe("en");
    const parametros = body.template.components[0]!.parameters;
    expect(parametros.map((parametro) => parametro.parameter_name)).toEqual([
      "nombre",
      "fecha",
      "empresa",
      "tiempohasta",
    ]);
    expect(parametros.map((parametro) => parametro.text)).toEqual([
      PACIENTE.nombre_completo,
      expect.any(String), // fecha localizada
      "PsicoAgenda",
      "en 2 horas",
    ]);
    fetchMock.mockRestore();
  });

  it("con una plantilla de texto plano no envía componentes de cuerpo", async () => {
    config.whatsappEnabled = true;
    config.whatsappTemplateParams = 0;
    prismaMock.notificaciones.findMany.mockResolvedValueOnce([fila(WHATSAPP)]);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(respuestaWhatsappOk());

    await despacharPendientes();

    const body = JSON.parse((fetchMock.mock.calls[0]![1] as { body: string }).body) as {
      template: { components?: unknown };
    };
    expect(body.template.components).toBeUndefined();
    fetchMock.mockRestore();
  });

  it("si la API de WhatsApp falla deja la fila pendiente con el error", async () => {
    config.whatsappEnabled = true;
    prismaMock.notificaciones.findMany.mockResolvedValueOnce([fila(WHATSAPP)]);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("token inválido", { status: 401 }));

    await despacharPendientes();

    expect(prismaMock.notificaciones.update).toHaveBeenCalledWith({
      where: { id: "n-WHATSAPP" },
      data: {
        estado: estado_envio.PENDIENTE,
        error: "WhatsApp respondió 401: token inválido",
      },
    });
    fetchMock.mockRestore();
  });
});
