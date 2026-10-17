import {
  NotificationChannel as SharedChannel,
  NotificationStatus as SharedStatus,
  type Notification,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import { canal_notificacion, estado_envio } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
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
  createdAt: row.creado_en,
});

/** Notificaciones de la cuenta autenticada, más recientes primero. */
export async function listNotifications(auth: AuthenticatedUser, limit = 50): Promise<Notification[]> {
  const rows = await prisma.notificaciones.findMany({
    where: { usuario_id: auth.id },
    orderBy: [{ programada_para: "desc" }, { creado_en: "desc" }],
    take: limit,
  });

  return rows.map(toNotification);
}
