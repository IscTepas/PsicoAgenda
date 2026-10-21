"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BellOff, CheckCheck, Settings2 } from "lucide-react"
import type { Notification } from "@psicoagenda/shared"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PageHeader } from "../components/page-header"
import { formatShortDate } from "@/lib/format"
import { notificationService } from "@/services"

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)


  useEffect(() => {
    let cancelled = false

    notificationService
      .list()
      .then((rows) => {
        if (cancelled) return
        setNotifications(rows)
      })
      .catch(() => {
        if (!cancelled) setLoadError("No se pudieron cargar las notificaciones.")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const unreadCount = notifications.filter((n) => !n.readAt).length

  // Optimista: se marca en pantalla y se persiste; si falla, se recarga del servidor.
  const markAllAsRead = () => {
    const now = new Date()
    setNotifications((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })))
    notificationService
      .markAllRead()
      .catch(() => notificationService.list().then(setNotifications).catch(() => undefined))
  }
  const markAsRead = (id: string) => {
    const target = notifications.find((n) => n.id === id)
    if (!target || target.readAt) return
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date() } : n)))
    notificationService
      .markRead(id)
      .catch(() => notificationService.list().then(setNotifications).catch(() => undefined))
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <PageHeader
        title="Centro de Notificaciones y Alertas"
        description="Solicitudes, confirmaciones, cambios de horario y recordatorios de tus citas."
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

      {isLoading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando avisos…</div>
      ) : loadError ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-border/80 bg-muted/10">
          <BellOff className="size-8 text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground">No se pudieron cargar los avisos</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">{loadError}</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-6 rounded-2xl border border-dashed border-border/80 bg-muted/10">
          <BellOff className="size-8 text-muted-foreground mb-3" />
          <p className="text-sm font-semibold text-foreground">No tienes avisos</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Las confirmaciones, recordatorios y cambios de tus citas aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const isUnread = !notification.readAt
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
                          {formatShortDate(notification.sentAt ?? notification.createdAt)}
                        </CardDescription>
                      </div>
                    </div>
                    {isUnread && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-[11px] font-medium text-foreground/80">
                        <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                        Nuevo
                      </span>
                    )}
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
