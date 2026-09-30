"use client"

import { useState } from "react"
import Link from "next/link"
import {
  CalendarDays,
  Clock,
  Video,
  MapPin,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Users,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  UserCheck,
} from "lucide-react"
import {
  AppointmentStatus,
  AppointmentModality,
  type Appointment,
  type Patient,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MOCK_APPOINTMENTS,
  MOCK_PATIENTS,
  MOCK_PSYCHOLOGIST,
  formatAppointmentTime,
  formatShortDate,
  getPatientById,
} from "@/lib/mock-data"

function getInitials(name: string): string {
  const parts = name.trim().split(" ")
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }
  return (name[0] ?? "P").toUpperCase()
}

function getStatusBadge(status: AppointmentStatus) {
  switch (status) {
    case AppointmentStatus.CONFIRMED:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-3" />
          Confirmada
        </span>
      )
    case AppointmentStatus.PENDING:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
          <Clock className="size-3" />
          Por confirmar
        </span>
      )
    case AppointmentStatus.COMPLETED:
      return (
        <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          Completada
        </span>
      )
    case AppointmentStatus.CANCELLED:
      return (
        <span className="inline-flex items-center rounded-full border border-destructive/20 bg-destructive/10 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
          Cancelada
        </span>
      )
    case AppointmentStatus.NO_SHOW:
      return (
        <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          No asistió
        </span>
      )
  }
}

export function DashboardView() {
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS)
  const [agendaFilter, setAgendaFilter] = useState<"all" | "confirmed" | "pending">("all")
  const [copiedLink, setCopiedLink] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const today = new Date()

  // Consultas de hoy
  const todayAppointments = appointments.filter(
    (apt) =>
      new Date(apt.startTime).getDate() === today.getDate() &&
      new Date(apt.startTime).getMonth() === today.getMonth() &&
      new Date(apt.startTime).getFullYear() === today.getFullYear()
  )

  // Próxima cita (prioriza la de hoy no completada, o la más cercana)
  const upcomingToday = todayAppointments
    .filter(
      (apt) =>
        apt.status !== AppointmentStatus.COMPLETED &&
        apt.status !== AppointmentStatus.CANCELLED
    )
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  const nextAppointment = upcomingToday[0] ?? null
  const nextPatient = nextAppointment ? getPatientById(nextAppointment.patientId) : null

  // Métricas
  const pendingCount = appointments.filter(
    (apt) => apt.status === AppointmentStatus.PENDING
  ).length
  const confirmedTodayCount = todayAppointments.filter(
    (apt) => apt.status === AppointmentStatus.CONFIRMED
  ).length
  const virtualTodayCount = todayAppointments.filter(
    (apt) => apt.modality === AppointmentModality.VIRTUAL
  ).length
  const inPersonTodayCount = todayAppointments.filter(
    (apt) => apt.modality === AppointmentModality.IN_PERSON
  ).length

  // Filtrado de timeline de hoy
  const filteredTodayAppointments = todayAppointments.filter((apt) => {
    if (agendaFilter === "confirmed") return apt.status === AppointmentStatus.CONFIRMED
    if (agendaFilter === "pending") return apt.status === AppointmentStatus.PENDING
    return true
  })

  // Lista de solicitudes pendientes de confirmación
  const pendingAppointments = appointments.filter(
    (apt) => apt.status === AppointmentStatus.PENDING
  )

  const handleConfirm = (id: string, patientName: string) => {
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === id ? { ...apt, status: AppointmentStatus.CONFIRMED } : apt
      )
    )
    setActionMessage(`Cita con ${patientName} confirmada con éxito.`)
    setTimeout(() => setActionMessage(null), 3500)
  }

  const handleComplete = (id: string, patientName: string) => {
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === id ? { ...apt, status: AppointmentStatus.COMPLETED } : apt
      )
    )
    setActionMessage(`Consulta con ${patientName} marcada como completada.`)
    setTimeout(() => setActionMessage(null), 3500)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://meet.google.com/psi-diag-ses")
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* MENSAJE DE ACCIÓN RÁPIDA (FEEDBACK TEMPORAL ESTILO APPLE) */}
      {actionMessage && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground shadow-xs animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-3.5" />
            </div>
            <span className="font-medium text-[13px]">{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* BARRA OPERATIVA INTEGRADA (APPLE HEALTH / DASHBOARD TILES) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="group rounded-2xl border border-border/50 bg-card p-4 transition-all duration-150 hover:border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/80">
              Consultas hoy
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarDays className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-[26px] font-semibold tracking-[-0.03em] tabular-nums text-foreground leading-none">
            {todayAppointments.length}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/75 leading-tight">
            {virtualTodayCount} virtual{virtualTodayCount === 1 ? "" : "es"} •{" "}
            {inPersonTodayCount} presencial{inPersonTodayCount === 1 ? "" : "es"}
          </p>
        </div>

        <div className="group rounded-2xl border border-border/50 bg-card p-4 transition-all duration-150 hover:border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/80">
              Por confirmar
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-[26px] font-semibold tracking-[-0.03em] tabular-nums text-foreground leading-none">
              {pendingCount}
            </span>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                Atención
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/75 leading-tight">
            {pendingCount === 1 ? "1 cita pendiente" : `${pendingCount} citas pendientes`}
          </p>
        </div>

        <div className="group rounded-2xl border border-border/50 bg-card p-4 transition-all duration-150 hover:border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/80">
              Pacientes activos
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-[26px] font-semibold tracking-[-0.03em] tabular-nums text-foreground leading-none">
            {MOCK_PATIENTS.length}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/75 leading-tight">
            1 menor con tutor legal (RD-11)
          </p>
        </div>

        <div className="group rounded-2xl border border-border/50 bg-card p-4 transition-all duration-150 hover:border-border/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium tracking-wide uppercase text-muted-foreground/80">
              Expedientes clínicos
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-[26px] font-semibold tracking-[-0.03em] tabular-nums text-foreground leading-none">
            100%
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground/75 leading-tight">
            Notas al día y actualizadas
          </p>
        </div>
      </div>

      {/* DISPOSICIÓN PRINCIPAL DE 2 COLUMNAS */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* COLUMNA IZQUIERDA / PRINCIPAL: HERO PRÓXIMA CITA + CRONOGRAMA */}
        <div className="lg:col-span-2 space-y-6">
          {/* HERO CARD: PRÓXIMA CONSULTA / EN CURSO */}
          {nextAppointment && nextPatient ? (
            <div className="rounded-2xl border border-primary/20 bg-card shadow-xs overflow-hidden transition-all duration-200">
              {/* Header de la tarjeta */}
              <div className="px-5 py-3.5 border-b border-border/40 flex flex-wrap items-center justify-between gap-2.5 bg-muted/15">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                    Próxima consulta en agenda
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {nextAppointment.modality === AppointmentModality.VIRTUAL ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/90 px-2.5 py-0.5 text-xs text-muted-foreground">
                      <Video className="size-3 text-primary" />
                      Videollamada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/90 px-2.5 py-0.5 text-xs text-muted-foreground">
                      <MapPin className="size-3 text-primary" />
                      Consultorio Presencial
                    </span>
                  )}
                  {getStatusBadge(nextAppointment.status)}
                </div>
              </div>

              {/* Contenido principal de la cita */}
              <div className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <Avatar size="lg" className="border border-border/40 size-12 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                        {getInitials(nextPatient.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/pacientes/${nextPatient.id}`}
                          className="text-[17px] font-semibold tracking-[-0.015em] text-foreground hover:text-primary transition-colors"
                        >
                          {nextPatient.name}
                        </Link>
                        {nextPatient.isMinor && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                            Menor de edad
                          </span>
                        )}
                      </div>

                      <p className="text-[13px] text-muted-foreground flex items-center gap-1.5">
                        <FileText className="size-3.5 text-muted-foreground/70" />
                        <span>{nextAppointment.reason || "Consulta psicológica general"}</span>
                      </p>

                      {nextPatient.isMinor && nextPatient.legalGuardian && (
                        <p className="text-[12px] text-muted-foreground/80">
                          Tutor/a: <span className="font-medium text-foreground">{nextPatient.legalGuardian.name}</span> ({nextPatient.legalGuardian.relationship})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/40 p-3 sm:px-4 sm:py-3 border border-border/30 sm:text-right shrink-0">
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
                      Horario previsto
                    </div>
                    <div className="text-base font-semibold tabular-nums text-foreground tracking-tight mt-0.5">
                      {formatAppointmentTime(new Date(nextAppointment.startTime))} hrs
                    </div>
                    <div className="text-[11px] text-muted-foreground/75 mt-0.5">
                      Duración: {nextAppointment.durationMinutes} minutos
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de acción al pie de la tarjeta */}
              <div className="px-5 py-3 bg-muted/15 border-t border-border/40 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {nextAppointment.modality === AppointmentModality.VIRTUAL ? (
                    <>
                      <Button
                        size="sm"
                        className="rounded-xl bg-primary text-primary-foreground font-medium gap-1.5 shadow-xs hover:bg-primary/90 active:scale-[0.98] transition-all"
                        asChild
                      >
                        <a
                          href="https://meet.google.com/psi-diag-ses"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Video className="size-3.5" />
                          Entrar a videollamada
                          <ExternalLink className="size-3 opacity-60" />
                        </a>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyLink}
                        className="rounded-xl border-border/60 bg-background/80 hover:bg-muted/60 active:scale-[0.98] transition-all gap-1.5 text-xs font-medium"
                      >
                        {copiedLink ? (
                          <>
                            <Check className="size-3.5 text-emerald-600" />
                            <span>¡Enlace copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="size-3.5 text-muted-foreground" />
                            <span>Copiar enlace</span>
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="rounded-xl bg-primary text-primary-foreground font-medium gap-1.5 shadow-xs hover:bg-primary/90 active:scale-[0.98] transition-all"
                      onClick={() => handleComplete(nextAppointment.id, nextPatient.name)}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Registrar asistencia
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    className="rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors gap-1.5"
                  >
                    <Link href={`/pacientes/${nextPatient.id}`}>
                      <FileText className="size-3.5" />
                      Expediente clínico
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center bg-card">
              <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <CheckCircle2 className="size-5" />
              </div>
              <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
                No tienes consultas inmediatas pendientes
              </h2>
              <p className="text-[13px] text-muted-foreground mt-1 max-w-md mx-auto">
                Has atendido las sesiones programadas para este momento. Puedes agendar nuevas citas o revisar los expedientes clínicos de tus pacientes.
              </p>
              <div className="mt-4 flex justify-center gap-2.5">
                <Button size="sm" asChild className="rounded-xl font-medium shadow-xs">
                  <Link href="/agenda/nueva">
                    <Plus className="mr-1.5 size-3.5" />
                    Agendar cita
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="rounded-xl border-border/60">
                  <Link href="/pacientes">Ver pacientes</Link>
                </Button>
              </div>
            </div>
          )}

          {/* CRONOGRAMA DE HOY (APPLE SEGMENTED TIMELINE) */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-semibold tracking-[-0.015em] text-foreground">
                  Cronograma de hoy
                </h3>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  {formatShortDate(today)} • {todayAppointments.length} sesiones en total
                </p>
              </div>

              {/* Segmented Control estilo Apple */}
              <Tabs
                value={agendaFilter}
                onValueChange={(val) => setAgendaFilter(val as typeof agendaFilter)}
              >
                <TabsList className="bg-muted/70 p-0.5 rounded-xl border border-border/30 h-7.5 gap-0.5">
                  <TabsTrigger
                    value="all"
                    className="rounded-lg text-xs font-medium px-2.5 py-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                  >
                    Todas ({todayAppointments.length})
                  </TabsTrigger>
                  <TabsTrigger
                    value="confirmed"
                    className="rounded-lg text-xs font-medium px-2.5 py-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                  >
                    Confirmadas ({confirmedTodayCount})
                  </TabsTrigger>
                  <TabsTrigger
                    value="pending"
                    className="rounded-lg text-xs font-medium px-2.5 py-1 text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-2xs transition-all"
                  >
                    Pendientes ({todayAppointments.length - confirmedTodayCount})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="p-5">
              {filteredTodayAppointments.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No hay citas que coincidan con este filtro para hoy.
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                  {filteredTodayAppointments.map((apt) => {
                    const patient = getPatientById(apt.patientId)
                    const isNext = nextAppointment?.id === apt.id

                    return (
                      <div key={apt.id} className="relative group">
                        {/* Indicador de nodo temporal */}
                        <div
                          className={`absolute -left-6 top-3 size-2.5 rounded-full border-2 border-background ring-1 ${
                            isNext
                              ? "bg-primary ring-primary"
                              : apt.status === AppointmentStatus.COMPLETED
                              ? "bg-muted-foreground/60 ring-border"
                              : "bg-background ring-border"
                          }`}
                        />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/40 bg-card p-3.5 hover:border-border/80 hover:bg-muted/20 transition-all duration-150">
                          <div className="flex items-start gap-3">
                            <div className="text-center shrink-0 w-16 pt-0.5">
                              <span className="block text-sm font-semibold tabular-nums text-foreground tracking-tight">
                                {formatAppointmentTime(new Date(apt.startTime))}
                              </span>
                              <span className="block text-[11px] text-muted-foreground/75">
                                {apt.durationMinutes} min
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/pacientes/${apt.patientId}`}
                                  className="font-medium text-sm text-foreground hover:text-primary transition-colors hover:underline"
                                >
                                  {patient?.name ?? "Paciente"}
                                </Link>
                                {getStatusBadge(apt.status)}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  {apt.modality === AppointmentModality.VIRTUAL ? (
                                    <>
                                      <Video className="size-3 text-primary" />
                                      Virtual
                                    </>
                                  ) : (
                                    <>
                                      <MapPin className="size-3 text-primary" />
                                      Presencial
                                    </>
                                  )}
                                </span>
                                <span className="opacity-40">•</span>
                                <span>{apt.reason || "Sesión regular"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {apt.status === AppointmentStatus.PENDING && (
                              <Button
                                size="xs"
                                variant="outline"
                                className="rounded-lg text-xs font-medium border-amber-300/80 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 active:scale-[0.97] transition-all"
                                onClick={() =>
                                  handleConfirm(apt.id, patient?.name ?? "el paciente")
                                }
                              >
                                <Check className="size-3 mr-1" />
                                Confirmar
                              </Button>
                            )}

                            {apt.status === AppointmentStatus.CONFIRMED && (
                              <Button
                                size="xs"
                                variant="ghost"
                                className="rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all"
                                onClick={() =>
                                  handleComplete(apt.id, patient?.name ?? "el paciente")
                                }
                              >
                                Finalizar
                              </Button>
                            )}

                            <Button size="xs" variant="ghost" className="rounded-lg size-7 p-0" asChild>
                              <Link href={`/pacientes/${apt.patientId}`} title="Ver ficha">
                                <ChevronRight className="size-4 text-muted-foreground/70" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-border/40 flex items-center justify-between bg-muted/10">
              <span className="text-[11px] text-muted-foreground/75">
                Zona horaria clínica: America/Mexico_City
              </span>
              <Button variant="link" size="sm" asChild className="text-xs text-primary p-0 h-auto font-medium">
                <Link href="/agenda">Ir a la agenda completa →</Link>
              </Button>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: SOLICITUDES PENDIENTES & PACIENTES RECIENTES */}
        <div className="space-y-6">
          {/* BANDEJA DE SOLICITUDES POR CONFIRMAR */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between bg-muted/10">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Clock className="size-3.5" />
                </div>
                <h4 className="text-[14px] font-semibold text-foreground tracking-tight">
                  Solicitudes por confirmar
                </h4>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {pendingAppointments.length}
              </span>
            </div>

            <div className="p-4 space-y-3">
              {pendingAppointments.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="size-5 text-emerald-500 mx-auto mb-1.5" />
                  No tienes citas pendientes por confirmar
                </div>
              ) : (
                pendingAppointments.map((apt) => {
                  const patient = getPatientById(apt.patientId)

                  return (
                    <div
                      key={apt.id}
                      className="rounded-xl border border-border/40 p-3.5 space-y-2 bg-muted/20 hover:border-border/70 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm text-foreground tracking-tight">
                            {patient?.name ?? "Paciente"}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <CalendarDays className="size-3" />
                            <span>{formatShortDate(new Date(apt.startTime))}</span>
                            <span className="opacity-40">•</span>
                            <span className="tabular-nums font-medium">
                              {formatAppointmentTime(new Date(apt.startTime))}
                            </span>
                          </div>
                        </div>

                        <span className="rounded-full border border-border/40 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {apt.modality === AppointmentModality.VIRTUAL ? "Virtual" : "Presencial"}
                        </span>
                      </div>

                      {apt.reason && (
                        <p className="text-xs text-muted-foreground italic">
                          "{apt.reason}"
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/30">
                        <Button
                          size="xs"
                          className="rounded-lg bg-primary text-primary-foreground text-xs font-medium px-2.5 py-1 active:scale-[0.97] transition-all"
                          onClick={() => handleConfirm(apt.id, patient?.name ?? "el paciente")}
                        >
                          Confirmar
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          className="rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground"
                          asChild
                        >
                          <Link href={`/pacientes/${apt.patientId}`}>Ficha</Link>
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* PACIENTES EN TRATAMIENTO RECIENTE */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border/40 flex items-center justify-between bg-muted/10">
              <div className="flex items-center gap-2">
                <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Users className="size-3.5" />
                </div>
                <h4 className="text-[14px] font-semibold text-foreground tracking-tight">
                  Pacientes recientes
                </h4>
              </div>
              <Button variant="link" size="sm" asChild className="text-xs text-primary p-0 h-auto font-medium">
                <Link href="/pacientes">Ver todos</Link>
              </Button>
            </div>

            <div className="p-3 space-y-1">
              {MOCK_PATIENTS.slice(0, 3).map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-all duration-150"
                >
                  <div className="flex items-center gap-3">
                    <Avatar size="default" className="border border-border/40 size-8.5 shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-muted/60 text-foreground">
                        {getInitials(patient.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Link
                        href={`/pacientes/${patient.id}`}
                        className="text-[13px] font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                      >
                        {patient.name}
                      </Link>
                      <div className="text-[11px] text-muted-foreground/75 flex items-center gap-1.5 mt-0.5">
                        <span>{patient.gender === "femenino" ? "Mujer" : "Hombre"}</span>
                        <span className="opacity-40">•</span>
                        <span>{patient.isMinor ? "Menor (con tutor)" : "Adulto"}</span>
                      </div>
                    </div>
                  </div>

                  <Button variant="ghost" size="xs" className="rounded-lg size-7 p-0" asChild>
                    <Link href={`/pacientes/${patient.id}`} title="Ver expediente">
                      <FileText className="size-3.5 text-muted-foreground hover:text-primary transition-colors" />
                    </Link>
                  </Button>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-border/40 bg-muted/5">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-xl text-xs font-medium border-border/60 hover:bg-muted/60 active:scale-[0.98] transition-all"
                asChild
              >
                <Link href="/agenda/nueva">
                  <Plus className="mr-1.5 size-3.5" />
                  Agendar consulta manual
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
