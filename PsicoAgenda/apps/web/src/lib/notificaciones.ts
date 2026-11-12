import {
  AppointmentModality,
  AppointmentRequestStatus,
  AppointmentStatus,
  type Appointment,
  type Notification,
} from "@psicoagenda/shared"

/** Nombre del tipo de aviso, para la pastilla de la tarjeta. */
export const TIPO_DE_AVISO: Record<Notification["kind"], string> = {
  reminder: "Recordatorio",
  confirmation: "Confirmación",
  change: "Cambio",
  cancellation: "Cancelación",
  request: "Solicitud",
  rejection: "Rechazo",
  attendance: "Asistencia",
  homework: "Tarea",
}

export interface AccionDeAviso {
  href: string
  /** Texto del botón ("Pedir otro horario", "Videollamada"…). */
  label: string
  /** Abre fuera de la app (mapa, videollamada). */
  external?: boolean
}

export interface ContextoDeAviso {
  esPaciente: boolean
  /** La cita del aviso, si se conoce: decide Videollamada / Cómo llegar. */
  cita?: Pick<Appointment, "modality" | "startTime" | "status">
  /** Estado actual de la solicitud del aviso, si se conoce. */
  estadoSolicitud?: AppointmentRequestStatus
  /** Para no ofrecer acciones de una cita que ya pasó. */
  ahora: Date
  mapsUrl: string
  videoUrl: string
}

export interface AccionesDeAviso {
  /** El siguiente paso que ofrece la tarjeta del aviso, si lo hay. Nunca lleva a modificar la cita. */
  principal: AccionDeAviso | null
  /** Botones adicionales en la tarjeta. */
  extras: AccionDeAviso[]
  /** Solicitudes: en qué quedó ("Aceptada", "Esperando tu respuesta"…). */
  estado: string | null
  /** La solicitud sigue pendiente: se responde arriba, en "Por responder". */
  pendiente: boolean
}

const ESTADO_SOLICITUD: Record<AppointmentRequestStatus, string> = {
  [AppointmentRequestStatus.PENDING]: "Esperando tu respuesta",
  [AppointmentRequestStatus.ACCEPTED]: "Aceptada",
  [AppointmentRequestStatus.REJECTED]: "Rechazada",
  [AppointmentRequestStatus.CANCELLED]: "Cancelada por el paciente",
}

/**
 * Qué se puede hacer con un aviso, según su tipo, quién lo recibe y en qué está
 * su cita o solicitud. Sin acciones = solo informa: abrirlo lo marca como leído.
 */
export function accionesDeAviso(
  aviso: Pick<Notification, "kind" | "appointmentId" | "requestId">,
  ctx: ContextoDeAviso,
): AccionesDeAviso {
  const vacio: AccionesDeAviso = { principal: null, extras: [], estado: null, pendiente: false }

  switch (aviso.kind) {
    case "request": {
      if (ctx.esPaciente) return vacio
      const estado = ctx.estadoSolicitud ? ESTADO_SOLICITUD[ctx.estadoSolicitud] : null
      return { ...vacio, estado, pendiente: ctx.estadoSolicitud === AppointmentRequestStatus.PENDING }
    }
    case "homework":
      return ctx.esPaciente ? { ...vacio, principal: { href: "/dashboard#tareas", label: "Ver mi tarea" } } : vacio
    case "rejection":
      return ctx.esPaciente ? { ...vacio, principal: { href: "/agenda/nueva", label: "Pedir otro horario" } } : vacio
    case "cancellation":
      return ctx.esPaciente
        ? { ...vacio, principal: { href: "/agenda/nueva", label: "Solicitar otra cita" } }
        : vacio
    case "reminder":
    case "confirmation":
    case "change":
    case "attendance": {
      const extras: AccionDeAviso[] = []
      const cita = ctx.cita
      const vigente =
        cita &&
        new Date(cita.startTime).getTime() > ctx.ahora.getTime() - 60 * 60_000 &&
        (cita.status === AppointmentStatus.CONFIRMED || cita.status === AppointmentStatus.PENDING)
      if (vigente && cita.modality === AppointmentModality.VIRTUAL) {
        extras.push({ href: ctx.videoUrl, label: "Videollamada", external: true })
      } else if (vigente && ctx.esPaciente) {
        extras.push({ href: ctx.mapsUrl, label: "Cómo llegar", external: true })
      }
      return { ...vacio, extras }
    }
    default:
      return vacio
  }
}
