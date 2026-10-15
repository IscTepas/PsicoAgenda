"use client"

import { useState } from "react"
import Link from "next/link"
import { BellOff, CheckCheck, Settings2 } from "lucide-react"
import { NotificationStatus } from "@psicoagenda/shared"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "../components/page-header"
import { MOCK_NOTIFICATIONS, formatShortDate } from "@/lib/mock-data"

// Mismo estilo de estado que el resto de la app: pastilla gris + punto de color.
const STATUS_PILL: Record<NotificationStatus, { label: string; dot: string }> = {
  [NotificationStatus.PENDING]: { label: "Pendiente", dot: "bg-amber-500" },
  [NotificationStatus.SENT]: { label: "Enviada", dot: "bg-primary" },
  [NotificationStatus.FAILED]: { label: "Fallida", dot: "bg-destructive" },
  [NotificationStatus.CANCELLED]: { label: "Cancelada", dot: "bg-muted-foreground/50" },
}

export default function NotificationsPage() {
  // Las primeras dos (ya enviadas) arrancan sin leer para poder demostrar el flujo;
  // en producción este estado vendría del backend, no de un cálculo local.
  const [unreadIds, setUnreadIds] = useState<Set<string>>(
    () => new Set(MOCK_NOTIFICATIONS.map((n) => n.id)),
  )

  const unreadCount = unreadIds.size

  const markAllAsRead = () => setUnreadIds(new Set())
  const markAsRead = (id: string) =>
    setUnreadIds((prev) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Centro de Notificaciones y Alertas"
        description="Confirmaciones de citas, cambios de horario y recordatorios automáticos enviados por el sistema."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="rounded-xl text-xs font-medium h-9 border-border/80"
            >
              <Link href="/notificaciones/configuracion">
                <Settings2 className="mr-1.5 size-3.5" />
                Preferencias
              </Link>
            </Button>
            <Button
              size="sm"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="rounded-xl text-xs font-semibold h-9 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            >
              <CheckCheck className="mr-1.5 size-3.5" />
              Marcar todo como leído
            </Button>
          </div>
        }
      />

      {MOCK_NOTIFICATIONS.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-border/80 bg-muted/10">
          <BellOff className="size-8 text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground">No tienes avisos</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Las confirmaciones, recordatorios y cambios de tus citas aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {MOCK_NOTIFICATIONS.map((notification) => {
            const status = STATUS_PILL[notification.status]
            const isUnread = unreadIds.has(notification.id)
            return (
              <Card
                key={notification.id}
                onClick={() => markAsRead(notification.id)}
                className={`rounded-2xl shadow-2xs cursor-pointer transition-colors ${
                  isUnread
                    ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
                    : "border-border/70 hover:bg-muted/20"
                }`}
              >
                <CardHeader className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className={`mt-1.5 size-2 rounded-full shrink-0 ${
                          isUnread ? "bg-primary" : "bg-transparent"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <CardTitle
                          className={`text-sm ${isUnread ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}
                        >
                          {notification.subject}
                        </CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {notification.channel === "whatsapp" ? "WhatsApp" : "Correo electrónico"} ·{" "}
                          {notification.scheduledFor
                            ? formatShortDate(notification.scheduledFor)
                            : "Sin programar"}
                        </CardDescription>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-[11px] font-medium text-foreground/80">
                      <span className={`size-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
                      {status.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="pb-4 pt-0 pl-9">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {notification.message}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
