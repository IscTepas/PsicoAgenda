import { Bell } from "lucide-react"
import { APP_NAME, NotificationStatus } from "@psicoagenda/shared"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeader } from "../components/page-header"
import { MOCK_NOTIFICATIONS, formatShortDate } from "@/lib/mock-data"

export const metadata = {
  title: `Notificaciones | ${APP_NAME}`,
}

function statusLabel(status: NotificationStatus) {
  switch (status) {
    case NotificationStatus.PENDING:
      return { label: "Pendiente", variant: "secondary" as const }
    case NotificationStatus.SENT:
      return { label: "Enviada", variant: "default" as const }
    case NotificationStatus.FAILED:
      return { label: "Fallida", variant: "destructive" as const }
    case NotificationStatus.CANCELLED:
      return { label: "Cancelada", variant: "outline" as const }
  }
}

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificaciones"
        description="Recordatorios y avisos del sistema"
      />

      <Alert>
        <Bell className="size-4" />
        <AlertTitle>Aviso</AlertTitle>
        <AlertDescription>
          Las notificaciones reales se enviarán por correo y WhatsApp cuando el
          módulo de notificaciones esté activo.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        {MOCK_NOTIFICATIONS.map((notification) => {
          const status = statusLabel(notification.status)
          return (
            <Card key={notification.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base">
                      {notification.subject}
                    </CardTitle>
                    <CardDescription>
                      {notification.channel === "whatsapp" ? "WhatsApp" : "Correo electrónico"} ·{" "}
                      {notification.scheduledFor
                        ? formatShortDate(notification.scheduledFor)
                        : "Sin programar"}
                    </CardDescription>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {notification.message}
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    Confirmar
                  </Button>
                  <Button variant="ghost" size="sm" disabled>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
