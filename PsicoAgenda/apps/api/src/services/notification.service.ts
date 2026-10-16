import {
  NotificationChannel as SharedChannel,
  NotificationStatus as SharedStatus,
  type Notification,
} from "@psicoagenda/shared";
import type { Prisma } from "@/generated/prisma/client";
import {
  NotificationChannel,
  NotificationStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser } from "@/utils/jwt";

type NotificationRow = Prisma.NotificationModel;

const toSharedStatus = (status: NotificationStatus): SharedStatus => {
  switch (status) {
    case NotificationStatus.PENDING:
      return SharedStatus.PENDING;
    case NotificationStatus.SENT:
      return SharedStatus.SENT;
    case NotificationStatus.FAILED:
      return SharedStatus.FAILED;
    case NotificationStatus.CANCELLED:
      return SharedStatus.CANCELLED;
  }
};

const toSharedChannel = (channel: NotificationChannel): SharedChannel => {
  switch (channel) {
    case NotificationChannel.WHATSAPP:
      return SharedChannel.WHATSAPP;
    case NotificationChannel.EMAIL:
      return SharedChannel.EMAIL;
  }
};

const toNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  patientId: row.userId,
  appointmentId: row.appointmentId ?? undefined,
  channel: toSharedChannel(row.channel),
  subject: row.subject,
  message: row.message,
  status: toSharedStatus(row.status),
  scheduledFor: row.scheduledFor ?? undefined,
  sentAt: row.sentAt ?? undefined,
  error: row.error ?? undefined,
  attempts: row.attempts,
  createdAt: row.createdAt,
});

/** Notificaciones de la cuenta autenticada, más recientes primero. */
export async function listNotifications(auth: AuthenticatedUser): Promise<Notification[]> {
  const rows = await prisma.notification.findMany({
    where: { userId: auth.id },
    orderBy: [{ scheduledFor: "desc" }, { createdAt: "desc" }],
  });

  return rows.map(toNotification);
}
