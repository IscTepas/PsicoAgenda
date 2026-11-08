"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowUpRight, BellOff, CheckCheck, ChevronRight, MapPin, Settings2, Video } from "lucide-react"
import {
  AppointmentModality,
  AppointmentStatus,
  UserRole,
  type Appointment,
  type Notification,
} from "@psicoagenda/shared"
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs"
import { Button } from "@/components/ui/button"
import { PRACTICE } from "@/app/home-content"
import { PageHeader } from "../components/page-header"
import { formatAppointmentTime } from "@/lib/format"
import { accionesDeAviso, type AccionDeAviso } from "@/lib/notificaciones"
import { useSession } from "@/lib/use-session"
import { cn } from "@/lib/utils"
import { appointmentRequestService, appointmentService, notificationService } from "@/services"
import { PendingInbox } from "./pending-inbox"

const DAY = 24 * 60 * 60_000
const VIDEO_URL = "https://meet.google.com/psi-diag-ses"
const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(PRACTICE.mapQuery)}`

type Filtro = "todos" | "sin-leer"

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Hoy / Ayer / Esta semana / Anteriores, según cuándo llegó el aviso. */
function grupoDe(fecha: Date, hoy: Date): string {
  const dias = Math.round((startOfDay(hoy).getTime() - startOfDay(fecha).getTime()) / DAY)
  if (dias <= 0) return "Hoy"
  if (dias === 1) return "Ayer"
  if (dias < 7) return "Esta semana"
  return "Anteriores"
}

function horaDe(fecha: Date, grupo: string): string {
  if (grupo === "Hoy" || grupo === "Ayer") return formatAppointmentTime(fecha)
  return capitalize(fecha.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }))
}

export default function NotificationsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const esPaciente = user?.role === UserRole.PATIENT
  const [filtro, setFiltro] = useState<Filtro>("todos")
  const hoy = useMemo(() => new Date(), [])

  const avisos = useQuery({
    queryKey: ["notifications", "page"],
    queryFn: () => notificationService.list(undefined, 100),
    staleTime: 30_000,
  })

  const lista = avisos.data ?? []
  // Contexto para las acciones, solo si hace falta: las citas sirven para Videollamada /
  // Cómo llegar (citas por venir, no el historial) y las solicitudes, para su estado.
  const hayAvisosDeCita = lista.some((n) => n.appointmentId)
  const hayAvisosDeSolicitud = lista.some((n) => n.requestId)
  const { data: citas = [] } = useQuery({
    queryKey: ["appointments", "notif-range"],
    queryFn: () =>
      appointmentService.list({
        from: new Date(startOfDay(hoy).getTime() - DAY),
        to: new Date(startOfDay(hoy).getTime() + 120 * DAY),
        limit: 200,
      }),
    enabled: Boolean(user) && (hayAvisosDeCita || esPaciente),
    staleTime: 60_000,
  })
  const { data: solicitudes = [] } = useQuery({
    queryKey: ["appointment-requests", "all"],
    queryFn: () => appointmentRequestService.list(),
    enabled: Boolean(user) && !esPaciente && hayAvisosDeSolicitud,
    staleTime: 60_000,
  })
  const citaPorId = useMemo(() => new Map(citas.map((c) => [c.id, c])), [citas])
  const estadoPorSolicitud = useMemo(() => new Map(solicitudes.map((s) => [s.id, s.status])), [solicitudes])

  const sinLeer = lista.filter((n) => !n.readAt).length
  const visibles = filtro === "sin-leer" ? lista.filter((n) => !n.readAt) : lista

  const grupos = useMemo(() => {
    const mapa = new Map<string, Notification[]>()
    for (const aviso of visibles) {
      const grupo = grupoDe(aviso.sentAt ?? aviso.createdAt, hoy)
      mapa.set(grupo, [...(mapa.get(grupo) ?? []), aviso])
    }
    return [...mapa]
  }, [visibles, hoy])

  const marcarLeido = (aviso: Notification) => {
    if (aviso.readAt) return
    queryClient.setQueryData<Notification[]>(["notifications", "page"], (prev) =>
      prev?.map((n) => (n.id === aviso.id ? { ...n, readAt: new Date() } : n)),
    )
    notificationService
      .markRead(aviso.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["notifications", "bell"] }))
      .catch(() => void avisos.refetch())
  }

  const marcarTodo = () => {
    queryClient.setQueryData<Notification[]>(["notifications", "page"], (prev) =>
      prev?.map((n) => (n.readAt ? n : { ...n, readAt: new Date() })),
    )
    notificationService
      .markAllRead()
      .then(() => queryClient.invalidateQueries({ queryKey: ["notifications", "bell"] }))
      .catch(() => void avisos.refetch())
  }

  const irAPendiente = (requestId?: string) => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const destino = (requestId && document.getElementById(`pendiente-${requestId}`)) || document.getElementById("por-responder")
    destino?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" })
  }

  const proxima = esPaciente
    ? citas
        .filter(
          (c) =>
            new Date(c.startTime) > hoy &&
            (c.status === AppointmentStatus.CONFIRMED || c.status === AppointmentStatus.PENDING),
        )
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
    : undefined

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="Notificaciones"
        description={
          esPaciente
            ? "Lo que pasa con tus citas, y qué hacer después."
            : "Responde solicitudes y revisa lo que pasó con tus citas."
        }
        actions={
          <Button variant="outline" size="sm" asChild className="h-9 rounded-xl text-xs font-medium">
            <Link href="/notificaciones/configuracion">
              <Settings2 className="mr-1.5 size-3.5" />
              Preferencias
            </Link>
          </Button>
        }
      />

      {user && (esPaciente ? proxima && <ProximaCita cita={proxima} /> : <PendingInbox />)}

      <section aria-labelledby="avisos-titulo" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="avisos-titulo" className="text-lg font-semibold tracking-tight text-foreground">
            Avisos
          </h2>
          <div className="flex items-center gap-2">
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filtro)} variant="segment">
              <TabsList aria-label="Filtrar avisos" className="bg-muted p-1">
                <TabsTrigger value="todos" className="px-3 py-1.5 text-xs">
                  Todos
                </TabsTrigger>
                <TabsTrigger value="sin-leer" className="px-3 py-1.5 text-xs">
                  Sin leer
                  <span className="ml-1.5 tabular-nums opacity-70">{sinLeer}</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="ghost"
              size="sm"
              onClick={marcarTodo}
              disabled={sinLeer === 0}
              className="text-muted-foreground"
            >
              <CheckCheck />
              <span className="hidden sm:inline">Marcar todo como leído</span>
            </Button>
          </div>
        </div>

        {avisos.isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-muted/30" />
            ))}
          </div>
        ) : avisos.isError ? (
          <Vacio titulo="No se pudieron cargar los avisos">
            <button type="button" onClick={() => void avisos.refetch()} className="font-medium text-primary hover:underline">
              Reintentar
            </button>
          </Vacio>
        ) : visibles.length === 0 ? (
          <Vacio titulo={filtro === "sin-leer" ? "Estás al día" : "No tienes avisos"}>
            {filtro === "sin-leer"
              ? "Ya leíste todos tus avisos."
              : "Las confirmaciones, recordatorios y cambios de tus citas aparecerán aquí."}
          </Vacio>
        ) : (
          <div className="space-y-6">
            {grupos.map(([grupo, items]) => (
              <div key={grupo} className="space-y-2">
                <h3 className="px-1 text-sm font-medium text-muted-foreground">{grupo}</h3>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {items.map((aviso) => {
                    const acciones = accionesDeAviso(aviso, {
                      esPaciente,
                      ahora: hoy,
                      mapsUrl: MAPS_URL,
                      videoUrl: VIDEO_URL,
                      cita: aviso.appointmentId ? citaPorId.get(aviso.appointmentId) : undefined,
                      estadoSolicitud: aviso.requestId ? estadoPorSolicitud.get(aviso.requestId) : undefined,
                    })
                    const unread = !aviso.readAt
                    const abrir = () => {
                      marcarLeido(aviso)
                      if (acciones.pendiente) irAPendiente(aviso.requestId)
                      else if (acciones.principal) router.push(acciones.principal.href)
                    }

                    return (
                      <li key={aviso.id} className={cn("relative transition-colors", unread && "bg-primary/[0.03]")}>
                        <button
                          type="button"
                          onClick={abrir}
                          className="flex w-full items-start gap-3 px-4 pt-4 pb-3 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 sm:px-5"
                        >
                          <span
                            className={cn("mt-1.5 size-2 shrink-0 rounded-full", unread ? "bg-primary" : "bg-transparent")}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-3">
                              <span className={cn("text-sm", unread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                                {aviso.subject}
                                {unread && <span className="sr-only"> (sin leer)</span>}
                              </span>
                              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                {horaDe(aviso.sentAt ?? aviso.createdAt, grupoDe(aviso.sentAt ?? aviso.createdAt, hoy))}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{aviso.message}</span>
                          </span>
                        </button>

                        {(acciones.principal || acciones.extras.length > 0 || acciones.estado) && (
                          <div className="flex flex-wrap items-center gap-2 pb-4 pl-9 pr-4 sm:pl-10 sm:pr-5">
                            {acciones.estado && (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium text-foreground/80">
                                <span
                                  className={cn("size-1.5 rounded-full", acciones.pendiente ? "bg-amber-500" : "bg-muted-foreground/50")}
                                  aria-hidden="true"
                                />
                                {acciones.estado}
                              </span>
                            )}
                            {acciones.pendiente && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  marcarLeido(aviso)
                                  irAPendiente(aviso.requestId)
                                }}
                              >
                                Responder
                              </Button>
                            )}
                            {acciones.principal && (
                              <BotonAccion accion={acciones.principal} variante="outline" onUse={() => marcarLeido(aviso)} />
                            )}
                            {acciones.extras.map((accion) => (
                              <BotonAccion key={accion.label} accion={accion} variante="ghost" onUse={() => marcarLeido(aviso)} />
                            ))}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function BotonAccion({
  accion,
  variante,
  onUse,
}: {
  accion: AccionDeAviso
  variante: "outline" | "ghost"
  onUse: () => void
}) {
  const Icon = accion.label === "Videollamada" ? Video : accion.label === "Cómo llegar" ? MapPin : null
  return (
    <Button asChild size="sm" variant={variante} className={cn(variante === "ghost" && "text-muted-foreground")}>
      {accion.external ? (
        <a href={accion.href} target="_blank" rel="noopener noreferrer" onClick={onUse}>
          {Icon && <Icon />}
          {accion.label}
          <ArrowUpRight />
        </a>
      ) : (
        <Link href={accion.href} onClick={onUse}>
          {accion.label}
          <ChevronRight />
        </Link>
      )}
    </Button>
  )
}

function ProximaCita({ cita }: { cita: Appointment }) {
  const inicio = new Date(cita.startTime)
  const virtual = cita.modality === AppointmentModality.VIRTUAL
  return (
    <section aria-labelledby="proxima-cita" className="space-y-3">
      <h2 id="proxima-cita" className="text-lg font-semibold tracking-tight text-foreground">
        Tu próxima cita
      </h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold tracking-tight text-foreground">
            {capitalize(inicio.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }))}
          </p>
          <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <span className="tabular-nums">{formatAppointmentTime(inicio)}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              {virtual ? <Video className="size-3.5" /> : <MapPin className="size-3.5" />}
              {virtual ? "Videollamada" : "Presencial"}
            </span>
            {cita.status === AppointmentStatus.PENDING && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-amber-700 dark:text-amber-400">Por confirmar</span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={virtual ? VIDEO_URL : MAPS_URL} target="_blank" rel="noopener noreferrer">
              {virtual ? <Video /> : <MapPin />}
              {virtual ? "Videollamada" : "Cómo llegar"}
            </a>
          </Button>
          <Button asChild size="sm">
            <Link href={`/agenda/${cita.id}`}>
              Ver cita
              <ChevronRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function Vacio({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/10 px-6 py-14 text-center">
      <BellOff className="mb-3 size-7 text-muted-foreground" />
      <p className="text-sm font-semibold text-foreground">{titulo}</p>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{children}</p>
    </div>
  )
}
