import { randomUUID } from "node:crypto";
import {
  APP_NAME,
  NotificationChannel as SharedChannel,
  NotificationStatus as SharedStatus,
  type Notification,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import {
  canal_notificacion,
  estado_envio,
  modalidad_cita,
  tipo_notificacion,
} from "@/generated/prisma/enums";
import { config } from "@/config";
import { prisma } from "@/lib/prisma";
import { enviarCorreoNotificacion } from "@/services/mailer.service";
import { AppError } from "@/utils/app-error";
import type { AuthenticatedUser } from "@/utils/jwt";

type NotificationRow = Prisma.notificacionesModel;

const toSharedStatus = (status: estado_envio): SharedStatus => {
  switch (status) {
    case estado_envio.PENDIENTE:
      return SharedStatus.PENDING;
    case estado_envio.ENVIADA:
      return SharedStatus.SENT;
    case estado_envio.FALLIDA:
      return SharedStatus.FAILED;
    case estado_envio.CANCELADA:
      return SharedStatus.CANCELLED;
  }
};

const toSharedChannel = (channel: canal_notificacion): SharedChannel => {
  switch (channel) {
    case canal_notificacion.WHATSAPP:
      return SharedChannel.WHATSAPP;
    case canal_notificacion.CORREO:
      return SharedChannel.EMAIL;
    case canal_notificacion.SISTEMA:
      return SharedChannel.SYSTEM;
  }
};

const toNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  patientId: row.usuario_id,
  appointmentId: row.cita_id ?? undefined,
  channel: toSharedChannel(row.canal),
  subject: row.asunto,
  message: row.mensaje,
  status: toSharedStatus(row.estado),
  scheduledFor: row.programada_para ?? undefined,
  sentAt: row.enviada_en ?? undefined,
  error: row.error ?? undefined,
  attempts: row.intentos,
  readAt: row.leida_en ?? undefined,
  createdAt: row.creado_en,
});

/**
 * Bandeja de la campana: solo el canal SISTEMA y solo lo que ya "llegó" (un
 * recordatorio programado no aparece antes de su hora). Correo y WhatsApp son
 * copias de entrega, no avisos aparte.
 */
const inboxWhere = (auth: AuthenticatedUser): Prisma.notificacionesWhereInput => ({
  usuario_id: auth.id,
  canal: canal_notificacion.SISTEMA,
  estado: estado_envio.ENVIADA,
});

/** Notificaciones de la cuenta autenticada, más recientes primero. */
export async function listNotifications(auth: AuthenticatedUser, limit = 50): Promise<Notification[]> {
  const rows = await prisma.notificaciones.findMany({
    where: inboxWhere(auth),
    orderBy: [{ enviada_en: "desc" }, { creado_en: "desc" }],
    take: limit,
  });

  return rows.map(toNotification);
}

export async function markNotificationRead(auth: AuthenticatedUser, id: string): Promise<Notification> {
  const row = await prisma.notificaciones.findFirst({ where: { id, ...inboxWhere(auth) } });

  if (!row) {
    throw AppError.notFound("La notificación no existe");
  }

  const updated = row.leida_en
    ? row
    : await prisma.notificaciones.update({ where: { id }, data: { leida_en: new Date() } });

  return toNotification(updated);
}

export async function markAllNotificationsRead(auth: AuthenticatedUser): Promise<{ updated: number }> {
  const { count } = await prisma.notificaciones.updateMany({
    where: { ...inboxWhere(auth), leida_en: null },
    data: { leida_en: new Date() },
  });

  return { updated: count };
}

// ---------------------------------------------------------------------------
// Reglas: qué evento avisa a quién y por qué canal.
// ---------------------------------------------------------------------------

export type EventoCita =
  | "SOLICITUD_CREADA"
  | "SOLICITUD_ACEPTADA"
  | "SOLICITUD_RECHAZADA"
  | "SOLICITUD_CANCELADA"
  | "CITA_AGENDADA"
  | "CITA_SOLICITADA"
  | "CITA_CONFIRMADA"
  | "CITA_MODIFICADA"
  | "CITA_CANCELADA_POR_PSICOLOGO"
  | "CITA_CANCELADA_POR_PACIENTE"
  | "CITA_ASISTENCIA";

type Recordatorios = "programar" | "cancelar";

interface Regla {
  para: "paciente" | "psicologo";
  tipo: tipo_notificacion;
  canales: canal_notificacion[];
  recordatorios?: Recordatorios;
}

const { SISTEMA, CORREO, WHATSAPP } = canal_notificacion;

/**
 * La campana recibe todo; el correo, lo que conviene tener por escrito; y
 * WhatsApp, solo lo que el paciente necesita ver a tiempo. La psicóloga no
 * recibe WhatsApp: trabaja dentro del sistema.
 */
export const REGLAS: Record<EventoCita, Regla> = {
  SOLICITUD_CREADA: { para: "psicologo", tipo: tipo_notificacion.SOLICITUD, canales: [SISTEMA, CORREO] },
  SOLICITUD_ACEPTADA: {
    para: "paciente",
    tipo: tipo_notificacion.CONFIRMACION,
    canales: [SISTEMA, CORREO, WHATSAPP],
    recordatorios: "programar",
  },
  SOLICITUD_RECHAZADA: {
    para: "paciente",
    tipo: tipo_notificacion.RECHAZO,
    canales: [SISTEMA, CORREO, WHATSAPP],
  },
  SOLICITUD_CANCELADA: { para: "psicologo", tipo: tipo_notificacion.CANCELACION, canales: [SISTEMA] },
  CITA_AGENDADA: {
    para: "paciente",
    tipo: tipo_notificacion.CONFIRMACION,
    canales: [SISTEMA, CORREO, WHATSAPP],
    recordatorios: "programar",
  },
  CITA_SOLICITADA: { para: "psicologo", tipo: tipo_notificacion.SOLICITUD, canales: [SISTEMA, CORREO] },
  // La cita ya se avisó completa al agendarla; confirmarla solo deja constancia.
  CITA_CONFIRMADA: {
    para: "paciente",
    tipo: tipo_notificacion.CONFIRMACION,
    canales: [SISTEMA],
    recordatorios: "programar",
  },
  // WhatsApp solo si cambió la fecha u hora (ver `canalesDelEvento`).
  CITA_MODIFICADA: {
    para: "paciente",
    tipo: tipo_notificacion.CAMBIO,
    canales: [SISTEMA, CORREO, WHATSAPP],
    recordatorios: "programar",
  },
  CITA_CANCELADA_POR_PSICOLOGO: {
    para: "paciente",
    tipo: tipo_notificacion.CANCELACION,
    canales: [SISTEMA, CORREO, WHATSAPP],
    recordatorios: "cancelar",
  },
  CITA_CANCELADA_POR_PACIENTE: {
    para: "psicologo",
    tipo: tipo_notificacion.CANCELACION,
    canales: [SISTEMA, CORREO],
    recordatorios: "cancelar",
  },
  CITA_ASISTENCIA: {
    para: "paciente",
    tipo: tipo_notificacion.ASISTENCIA,
    canales: [SISTEMA],
    recordatorios: "cancelar",
  },
};

/** Datos de la cita (o de la solicitud) que describe el aviso. */
export interface CitaAviso {
  citaId?: string;
  pacienteId: string;
  psicologoId: string;
  inicio: Date;
  duracionMinutos: number;
  modalidad: modalidad_cita;
  motivoCancelacion?: string | null;
  /** CITA_MODIFICADA: si cambió fecha u hora (solo entonces va por WhatsApp). */
  cambioHorario?: boolean;
  /** CITA_ASISTENCIA: true si asistió, false si no. */
  asistio?: boolean;
}

interface Destinatario {
  id: string;
  correo: string;
  nombre_completo: string;
  telefono: string | null;
  notificar_correo: boolean;
  notificar_whatsapp: boolean;
  zona_horaria: string;
}

const destinatarioSelect = {
  id: true,
  correo: true,
  nombre_completo: true,
  telefono: true,
  notificar_correo: true,
  notificar_whatsapp: true,
  zona_horaria: true,
} as const;

/** Canales finales: los de la regla, filtrados por las preferencias del destinatario. */
export function canalesDelEvento(
  evento: EventoCita,
  aviso: CitaAviso,
  destinatario: Pick<Destinatario, "notificar_correo" | "notificar_whatsapp" | "telefono">,
): canal_notificacion[] {
  return REGLAS[evento].canales.filter((canal) => {
    if (canal === CORREO) return destinatario.notificar_correo;
    if (canal === WHATSAPP) {
      if (evento === "CITA_MODIFICADA" && !aviso.cambioHorario) return false;
      return destinatario.notificar_whatsapp && Boolean(destinatario.telefono);
    }
    return true;
  });
}

// shortcut: las cuentas nuevas nacen con zona "UTC"; se asume la del consultorio hasta que el perfil la pida.
const ZONA_POR_DEFECTO = "America/Mazatlan"; // la del consultorio (Tepic, Nay.)

const formatearHorario = (fecha: Date, zona: string) => {
  const timeZone = zona && zona !== "UTC" ? zona : ZONA_POR_DEFECTO;
  return {
    fecha: fecha.toLocaleDateString("es-MX", { timeZone, weekday: "long", day: "numeric", month: "long" }),
    hora: fecha.toLocaleTimeString("es-MX", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  };
};

const modalidadTexto = (modalidad: modalidad_cita) =>
  modalidad === modalidad_cita.VIRTUAL ? "videollamada" : "presencial";

/** Asunto y texto del aviso, en la zona horaria de quien lo recibe. */
export function redactar(
  evento: EventoCita | "RECORDATORIO_24H" | "RECORDATORIO_2H",
  aviso: CitaAviso,
  destinatario: Pick<Destinatario, "zona_horaria">,
  contraparte: string,
): { asunto: string; mensaje: string } {
  const { fecha, hora } = formatearHorario(aviso.inicio, destinatario.zona_horaria);
  const diaHora = `${fecha} a las ${hora}`;
  const cuando = `el ${diaHora}`;
  const detalle = `${cuando} (${modalidadTexto(aviso.modalidad)}, ${aviso.duracionMinutos} min)`;
  const motivo = aviso.motivoCancelacion ? ` Motivo: ${aviso.motivoCancelacion}.` : "";

  switch (evento) {
    case "SOLICITUD_CREADA":
      return {
        asunto: "Nueva solicitud de cita",
        mensaje: `${contraparte} solicitó una cita ${detalle}. Revísala en tu agenda para aceptarla o rechazarla.`,
      };
    case "SOLICITUD_ACEPTADA":
      return {
        asunto: "Tu cita fue confirmada",
        mensaje: `${contraparte} aceptó tu solicitud. Tu cita es ${detalle}.`,
      };
    case "SOLICITUD_RECHAZADA":
      return {
        asunto: "Tu solicitud de cita no fue aceptada",
        mensaje: `${contraparte} no pudo aceptar tu solicitud para ${cuando}. Puedes pedir otro horario desde ${APP_NAME}.`,
      };
    case "SOLICITUD_CANCELADA":
      return {
        asunto: "Solicitud de cita retirada",
        mensaje: `${contraparte} retiró su solicitud de cita para ${cuando}.`,
      };
    case "CITA_AGENDADA":
      return {
        asunto: "Nueva cita agendada",
        mensaje: `${contraparte} agendó una cita para ti ${detalle}.`,
      };
    case "CITA_SOLICITADA":
      return {
        asunto: "Nueva cita por confirmar",
        mensaje: `${contraparte} agendó una cita ${detalle}. Confírmala desde tu agenda.`,
      };
    case "CITA_CONFIRMADA":
      return {
        asunto: "Tu cita fue confirmada",
        mensaje: `${contraparte} confirmó tu cita ${detalle}.`,
      };
    case "CITA_MODIFICADA":
      return {
        asunto: "Tu cita cambió",
        mensaje: `${contraparte} modificó tu cita. Ahora es ${detalle}.`,
      };
    case "CITA_CANCELADA_POR_PSICOLOGO":
      return {
        asunto: "Tu cita fue cancelada",
        mensaje: `${contraparte} canceló tu cita del ${diaHora}.${motivo}`,
      };
    case "CITA_CANCELADA_POR_PACIENTE":
      return {
        asunto: "Cita cancelada por el paciente",
        mensaje: `${contraparte} canceló su cita del ${diaHora}.${motivo}`,
      };
    case "CITA_ASISTENCIA":
      return aviso.asistio
        ? { asunto: "Sesión registrada", mensaje: `Registramos tu asistencia a la sesión del ${diaHora}. ¡Gracias!` }
        : {
            asunto: "Registramos tu inasistencia",
            mensaje: `No asististe a tu cita del ${diaHora}. Si fue un imprevisto, solicita un nuevo horario.`,
          };
    case "RECORDATORIO_24H":
      return {
        asunto: "Recordatorio: tu cita es mañana",
        mensaje: `Te recordamos tu cita con ${contraparte} ${detalle}.`,
      };
    case "RECORDATORIO_2H":
      return {
        asunto: "Tu cita es en 2 horas",
        mensaje:
          aviso.modalidad === modalidad_cita.VIRTUAL
            ? `Tu cita con ${contraparte} es hoy a las ${hora} por videollamada. Ten a la mano el enlace.`
            : `Tu cita con ${contraparte} es hoy a las ${hora}.`,
      };
  }
}

async function cargarPartes(aviso: CitaAviso) {
  const [paciente, psicologo] = await Promise.all([
    prisma.pacientes.findUnique({
      where: { id: aviso.pacienteId },
      select: { usuarios: { select: destinatarioSelect } },
    }),
    prisma.psicologos.findUnique({
      where: { id: aviso.psicologoId },
      select: { usuarios: { select: destinatarioSelect } },
    }),
  ]);

  if (!paciente || !psicologo) {
    throw new Error("No se encontraron el paciente o el psicólogo del aviso");
  }

  return { paciente: paciente.usuarios, psicologo: psicologo.usuarios };
}

const HORA = 60 * 60_000;

/**
 * Recordatorios de una cita activa: 24 h antes por los tres canales y 2 h antes
 * solo por WhatsApp. Siempre se reemplazan los pendientes, así que llamarlo de
 * nuevo tras mover la cita los reprograma.
 */
async function programarRecordatorios(aviso: CitaAviso, paciente: Destinatario, psicologo: Destinatario) {
  if (!aviso.citaId) return;

  await cancelarRecordatorios(aviso.citaId);

  const ahora = Date.now();
  const filas: Prisma.notificacionesCreateManyInput[] = [];
  const plan = [
    { clave: "RECORDATORIO_24H" as const, antes: 24 * HORA, canales: [SISTEMA, CORREO, WHATSAPP] },
    { clave: "RECORDATORIO_2H" as const, antes: 2 * HORA, canales: [WHATSAPP] },
  ];

  for (const { clave, antes, canales } of plan) {
    const programadaPara = new Date(aviso.inicio.getTime() - antes);
    if (programadaPara.getTime() <= ahora) continue;

    const { asunto, mensaje } = redactar(clave, aviso, paciente, psicologo.nombre_completo);
    for (const canal of canales) {
      if (canal === CORREO && !paciente.notificar_correo) continue;
      if (canal === WHATSAPP && !(paciente.notificar_whatsapp && paciente.telefono)) continue;
      filas.push({
        id: randomUUID(),
        usuario_id: paciente.id,
        cita_id: aviso.citaId,
        tipo: tipo_notificacion.RECORDATORIO,
        canal,
        asunto,
        mensaje,
        programada_para: programadaPara,
      });
    }
  }

  if (filas.length > 0) {
    await prisma.notificaciones.createMany({ data: filas });
  }
}

async function cancelarRecordatorios(citaId: string) {
  await prisma.notificaciones.updateMany({
    where: { cita_id: citaId, tipo: tipo_notificacion.RECORDATORIO, estado: estado_envio.PENDIENTE },
    data: { estado: estado_envio.CANCELADA },
  });
}

/**
 * Registra el aviso de un evento por cada canal que aplique y lo despacha.
 * Nunca lanza: un aviso que falla no debe tumbar la operación que ya se
 * guardó (la cita existe aunque el correo no salga).
 */
export async function notificar(evento: EventoCita, aviso: CitaAviso): Promise<void> {
  try {
    const regla = REGLAS[evento];
    const { paciente, psicologo } = await cargarPartes(aviso);
    const [destinatario, contraparte] =
      regla.para === "paciente" ? [paciente, psicologo] : [psicologo, paciente];

    const { asunto, mensaje } = redactar(evento, aviso, destinatario, contraparte.nombre_completo);
    const ahora = new Date();
    const canales = canalesDelEvento(evento, aviso, destinatario);

    await prisma.notificaciones.createMany({
      data: canales.map((canal) => ({
        id: randomUUID(),
        usuario_id: destinatario.id,
        cita_id: aviso.citaId ?? null,
        tipo: regla.tipo,
        canal,
        asunto,
        mensaje,
        programada_para: ahora,
      })),
    });

    if (regla.recordatorios === "programar") {
      await programarRecordatorios(aviso, paciente, psicologo);
    } else if (regla.recordatorios === "cancelar" && aviso.citaId) {
      await cancelarRecordatorios(aviso.citaId);
    }
  } catch (error) {
    console.error(`[notificaciones] No se pudo registrar el aviso ${evento}:`, error);
    return;
  }

  void despacharPendientes();
}

// ---------------------------------------------------------------------------
// Despachador: entrega lo pendiente cuya hora ya llegó.
// ---------------------------------------------------------------------------

const MAX_INTENTOS = 5;
const LOTE = 50;

const pendienteInclude = {
  usuarios: { select: { correo: true, nombre_completo: true, telefono: true } },
  citas: { select: { id: true, inicio: true, fin: true, modalidad: true, estado: true } },
} as const;

type FilaPendiente = Prisma.notificacionesGetPayload<{ include: typeof pendienteInclude }>;

const escaparHtml = (texto: string) =>
  texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const correoHtml = (fila: FilaPendiente) => `
  <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; color: #1f2937;">
    <h1 style="font-size: 20px; margin-bottom: 8px;">${APP_NAME}</h1>
    <h2 style="font-size: 16px; margin: 16px 0 8px;">${escaparHtml(fila.asunto)}</h2>
    <p style="font-size: 15px; line-height: 1.5;">Hola, ${escaparHtml(fila.usuarios.nombre_completo)}.</p>
    <p style="font-size: 15px; line-height: 1.5;">${escaparHtml(fila.mensaje)}</p>
    <p style="font-size: 12px; color: #6b7280; margin-top: 24px;">
      Puedes cambiar tus preferencias de aviso desde tu perfil en ${APP_NAME}.
    </p>
  </div>
`;

/**
 * WhatsApp sale por n8n: se le entrega todo lo necesario para armar la
 * plantilla. Sin URL configurada las filas se quedan PENDIENTES y se
 * entregarán en cuanto n8n esté conectado.
 */
async function enviarWhatsapp(fila: FilaPendiente): Promise<void> {
  const respuesta = await fetch(config.n8nWhatsappWebhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.n8nWebhookSecret ? { "X-PsicoAgenda-Secret": config.n8nWebhookSecret } : {}),
    },
    body: JSON.stringify({
      notificacionId: fila.id,
      tipo: fila.tipo,
      telefono: fila.usuarios.telefono,
      nombre: fila.usuarios.nombre_completo,
      asunto: fila.asunto,
      mensaje: fila.mensaje,
      cita: fila.citas,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!respuesta.ok) {
    throw new Error(`n8n respondió ${respuesta.status}`);
  }
}

async function entregar(fila: FilaPendiente): Promise<void> {
  switch (fila.canal) {
    case canal_notificacion.SISTEMA:
      return;
    case canal_notificacion.CORREO:
      return enviarCorreoNotificacion({
        to: fila.usuarios.correo,
        subject: `${APP_NAME}: ${fila.asunto}`,
        text: `Hola, ${fila.usuarios.nombre_completo}.\n\n${fila.mensaje}`,
        html: correoHtml(fila),
      });
    case canal_notificacion.WHATSAPP:
      return enviarWhatsapp(fila);
  }
}

let despachando = false;
// Si llega un aviso mientras se despacha, se da otra vuelta al terminar en vez de esperar al siguiente minuto.
let otraVuelta = false;

/** Entrega un lote de pendientes vencidos. Devuelve cuántas se procesaron. */
export async function despacharPendientes(): Promise<number> {
  if (despachando) {
    otraVuelta = true;
    return 0;
  }
  despachando = true;
  otraVuelta = false;

  try {
    const canales = config.n8nWhatsappWebhookUrl ? [SISTEMA, CORREO, WHATSAPP] : [SISTEMA, CORREO];
    const filas = await prisma.notificaciones.findMany({
      where: {
        estado: estado_envio.PENDIENTE,
        canal: { in: canales },
        intentos: { lt: MAX_INTENTOS },
        OR: [{ programada_para: null }, { programada_para: { lte: new Date() } }],
      },
      orderBy: { programada_para: "asc" },
      take: LOTE,
      include: pendienteInclude,
    });

    for (const fila of filas) {
      // Reclamo optimista: si otra instancia ya la tomó, `count` es 0 y se salta.
      const reclamada = await prisma.notificaciones.updateMany({
        where: { id: fila.id, estado: estado_envio.PENDIENTE, intentos: fila.intentos },
        data: { intentos: { increment: 1 } },
      });
      if (reclamada.count === 0) continue;

      try {
        await entregar(fila);
        await prisma.notificaciones.update({
          where: { id: fila.id },
          data: { estado: estado_envio.ENVIADA, enviada_en: new Date(), error: null },
        });
      } catch (error) {
        const agotada = fila.intentos + 1 >= MAX_INTENTOS;
        await prisma.notificaciones.update({
          where: { id: fila.id },
          data: {
            estado: agotada ? estado_envio.FALLIDA : estado_envio.PENDIENTE,
            error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
          },
        });
      }
    }

    return filas.length;
  } catch (error) {
    // Solo el mensaje: el despacho corre cada minuto y una caída de la base no debe inundar el log.
    const detalle = error instanceof Error ? error.message.trim().split("\n").pop() : String(error);
    console.error(`[notificaciones] Falló el despacho de pendientes: ${detalle}`);
    return 0;
  } finally {
    despachando = false;
    if (otraVuelta) void despacharPendientes();
  }
}

const INTERVALO_DESPACHO = 60_000;

/** Revisa la cola cada minuto (recordatorios programados y reintentos). */
export function iniciarDespachador(): () => void {
  void despacharPendientes();
  const timer = setInterval(() => void despacharPendientes(), INTERVALO_DESPACHO);
  timer.unref();
  return () => clearInterval(timer);
}
