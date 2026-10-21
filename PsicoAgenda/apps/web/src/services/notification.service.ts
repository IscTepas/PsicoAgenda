import type { Notification } from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

interface SerializedNotification
  extends Omit<Notification, "scheduledFor" | "sentAt" | "readAt" | "createdAt"> {
  scheduledFor?: string
  sentAt?: string
  readAt?: string
  createdAt: string
}

function reviveNotification(raw: SerializedNotification): Notification {
  return {
    ...raw,
    scheduledFor: raw.scheduledFor ? new Date(raw.scheduledFor) : undefined,
    sentAt: raw.sentAt ? new Date(raw.sentAt) : undefined,
    readAt: raw.readAt ? new Date(raw.readAt) : undefined,
    createdAt: new Date(raw.createdAt),
  }
}

export const notificationService = {
  list: async (token?: string, limit?: number): Promise<Notification[]> => {
    const q = limit && limit > 0 ? `?limit=${Math.min(limit, 100)}` : ""
    const rows = await apiFetch<SerializedNotification[]>(`/notifications${q}`, { token })
    return rows.map(reviveNotification)
  },

  markRead: async (id: string): Promise<Notification> =>
    reviveNotification(
      await apiFetch<SerializedNotification>(`/notifications/${id}/read`, { method: "POST" }),
    ),

  markAllRead: (): Promise<{ updated: number }> =>
    apiFetch<{ updated: number }>("/notifications/read-all", { method: "POST" }),
}
