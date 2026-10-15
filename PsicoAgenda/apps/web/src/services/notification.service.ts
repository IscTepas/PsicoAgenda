import type { Notification } from "@psicoagenda/shared"
import { apiFetch } from "@/lib/api-client"

interface SerializedNotification
  extends Omit<Notification, "scheduledFor" | "sentAt" | "createdAt"> {
  scheduledFor?: string
  sentAt?: string
  createdAt: string
}

function reviveNotification(raw: SerializedNotification): Notification {
  return {
    ...raw,
    scheduledFor: raw.scheduledFor ? new Date(raw.scheduledFor) : undefined,
    sentAt: raw.sentAt ? new Date(raw.sentAt) : undefined,
    createdAt: new Date(raw.createdAt),
  }
}

export const notificationService = {
  list: async (token?: string): Promise<Notification[]> => {
    const rows = await apiFetch<SerializedNotification[]>("/notifications", { token })
    return rows.map(reviveNotification)
  },
}
