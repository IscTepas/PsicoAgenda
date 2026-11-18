"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"
import { UserRole, type Notification } from "@psicoagenda/shared"
import { NotificationStack } from "@/components/motion/notification-stack"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useSession } from "@/lib/use-session"
import { usePendingResponses } from "@/lib/use-pending-responses"
import { cn } from "@/lib/utils"
import { notificationService } from "@/services"

/**
 * Campana de la barra superior: abre debajo una pila animada con los títulos de los avisos
 * sin leer (o de los recientes si todo está leído) que se despliega hacia abajo;
 * "Ver todas" lleva a Notificaciones.
 */
export function NotificationsButton({
  className,
  notifications: propNotifications,
}: {
  className?: string
  notifications?: Notification[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const { data: queryNotifications = [] } = useQuery<Notification[]>({
    queryKey: ["notifications", "bell"],
    queryFn: () => notificationService.list(undefined, 20),
    staleTime: 30_000,
    enabled: propNotifications === undefined,
  })
  const notifications = propNotifications ?? queryNotifications
  const unread = notifications.filter((n) => !n.readAt)
  const items = unread.length > 0 ? unread : notifications.slice(0, 3)
  const count = unread.length
  // A la psicóloga, lo que espera respuesta pesa más que lo no leído: se marca en ámbar.
  const { user } = useSession()
  const { count: pending } = usePendingResponses(user?.role === UserRole.PSYCHOLOGIST)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.97] data-[state=open]:bg-muted data-[state=open]:text-foreground",
            className
          )}
          aria-label={pending > 0 ? `Notificaciones (${pending} por responder)` : `Notificaciones (${count} sin leer)`}
          title="Notificaciones"
        >
          <Bell className="size-[18px]" />
          {(pending > 0 || count > 0) && (
            <span
              className={cn(
                "absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums ring-2 ring-background",
                // amber-700 con blanco pasa 4.5:1; el 500 no llegaba a 2.2:1.
                pending > 0 ? "bg-amber-700 text-white dark:bg-amber-400 dark:text-amber-950" : "bg-primary text-primary-foreground"
              )}
            >
              {pending > 0 ? pending : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-max max-w-[min(18rem,calc(100vw-2rem))] border-0 bg-transparent p-0 shadow-none"
      >
        {items.length > 0 ? (
          <NotificationStack
            direction="down"
            // Solo el título de cada aviso; el detalle está en Notificaciones.
            items={items.map((n) => ({ id: n.id, title: <span title={n.subject}>{n.subject}</span> }))}
            maxVisible={3}
            showCount={false}
            collapsedLabel="Ver todas"
            expandedLabel="Ver todas"
            onViewAll={() => {
              setOpen(false)
              router.push("/notificaciones")
            }}
            // Ancho según el texto (con tope en el panel), no un ancho fijo.
            className="w-max max-w-full"
            // Todas las tarjetas del mismo alto: título en una línea (con "…" si es largo) y relleno compacto.
            classNames={{ card: "px-3.5", content: "py-2.5", title: "truncate text-sm" }}
          />
        ) : (
          <div className="flex items-center gap-2 rounded-3xl bg-muted px-5 py-6 text-sm font-medium text-muted-foreground">
            <Bell className="size-4" aria-hidden="true" />
            Estás al día: no tienes avisos.
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
