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
  ShieldAlert,
  ArrowRight,
  Sparkles,
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
        <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 font-normal">
          <CheckCircle2 className="size-3 mr-1" />
          Confirmada
        </Badge>
      )
    case AppointmentStatus.PENDING:
      return (
        <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 font-normal">
          <Clock className="size-3 mr-1" />
          Por confirmar
        </Badge>
      )
    case AppointmentStatus.COMPLETED:
      return (
        <Badge variant="outline" className="text-muted-foreground font-normal">
          Completada
        </Badge>
      )
    case AppointmentStatus.CANCELLED:
      return (
        <Badge variant="destructive" className="font-normal">
          Cancelada
        </Badge>
      )
    case AppointmentStatus.NO_SHOW:
      return (
        <Badge variant="outline" className="text-muted-foreground font-normal">
          No asistió
        </Badge>
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
    setTimeout(() => setActionMessage(null), 4000)
  }

  const handleComplete = (id: string, patientName: string) => {
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === id ? { ...apt, status: AppointmentStatus.COMPLETED } : apt
      )
    )
    setActionMessage(`Consulta con ${patientName} marcada como completada.`)
    setTimeout(() => setActionMessage(null), 4000)
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText("https://meet.google.com/psi-diag-ses")
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  return (
    <div className="space-y-6">
      {/* MENSAJE DE ACCIÓN RÁPIDA (FEEDBACK TEMPORAL) */}
      {actionMessage && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Entendido
          </button>
        </div>
      )}

      {/* BARRA OPERATIVA INTEGRADA (CLINICAL WORKFLOW BAR) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Consultas hoy</span>
            <CalendarDays className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {todayAppointments.length}
          </div>
          <p className="text-xs text-muted-foreground">
            {virtualTodayCount} virtual{virtualTodayCount === 1 ? "" : "es"} •{" "}
            {inPersonTodayCount} presencial{inPersonTodayCount === 1 ? "" : "es"}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Por confirmar</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {pendingCount}
            </span>
            {pendingCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] px-1.5 py-0 border-amber-300">
                Atención
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {pendingCount === 1 ? "1 cita pendiente" : `${pendingCount} citas pendientes`}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Pacientes activos</span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {MOCK_PATIENTS.length}
          </div>
          <p className="text-xs text-muted-foreground">
            1 menor con tutor legal (RD-11)
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Expedientes clínicos</span>
            <UserCheck className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            100%
          </div>
          <p className="text-xs text-muted-foreground">
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
            <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/[0.04] via-card to-card shadow-sm">
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Próxima consulta en agenda
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {nextAppointment.modality === AppointmentModality.VIRTUAL ? (
                      <Badge variant="outline" className="bg-background/80 gap-1 text-xs">
                        <Video className="size-3 text-primary" />
                        Videollamada
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-background/80 gap-1 text-xs">
                        <MapPin className="size-3 text-primary" />
                        Consultorio Presencial
                      </Badge>
                    )}
                    {getStatusBadge(nextAppointment.status)}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <Avatar size="lg" className="border border-border">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getInitials(nextPatient.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/pacientes/${nextPatient.id}`}
                          className="text-lg font-bold text-foreground hover:text-primary transition-colors hover:underline"
                        >
                          {nextPatient.name}
                        </Link>
                        {nextPatient.isMinor && (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            Menor de edad
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <FileText className="size-3.5 text-muted-foreground" />
                        <span>{nextAppointment.reason || "Consulta psicológica general"}</span>
                      </p>

                      {nextPatient.isMinor && nextPatient.legalGuardian && (
                        <p className="text-xs text-muted-foreground">
                          Tutor/a: <span className="font-medium text-foreground">{nextPatient.legalGuardian.name}</span> ({nextPatient.legalGuardian.relationship})
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/60 p-3 sm:text-right border border-border/40">
                    <div className="text-xs font-medium text-muted-foreground">Horario previsto</div>
                    <div className="text-base font-bold tabular-nums text-foreground">
                      {formatAppointmentTime(new Date(nextAppointment.startTime))} hrs
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Duración: {nextAppointment.durationMinutes} minutos
                    </div>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2 pb-4 bg-muted/20 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {nextAppointment.modality === AppointmentModality.VIRTUAL ? (
                    <>
                      <Button
                        size="sm"
                        className="bg-primary text-primary-foreground gap-1.5 shadow-xs"
                        asChild
                      >
                        <a
                          href="https://meet.google.com/psi-diag-ses"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Video className="size-4" />
                          Entrar a videollamada
                          <ExternalLink className="size-3 opacity-70" />
                        </a>
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyLink}
                        className="gap-1.5"
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
                      className="bg-primary text-primary-foreground gap-1.5 shadow-xs"
                      onClick={() => handleComplete(nextAppointment.id, nextPatient.name)}
                    >
                      <CheckCircle2 className="size-4" />
                      Registrar asistencia
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
                    <Link href={`/pacientes/${nextPatient.id}`}>
                      <FileText className="size-3.5" />
                      Expediente clínico
                    </Link>
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ) : (
            <Card className="border-dashed p-6 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                <CheckCircle2 className="size-6" />
              </div>
              <h2 className="text-base font-semibold text-foreground">
                No tienes consultas inmediatas pendientes
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Has atendido las sesiones programadas para este momento. Puedes agendar nuevas citas o revisar los expedientes clínicos de tus pacientes.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Button size="sm" asChild>
                  <Link href="/agenda/nueva">
                    <Plus className="mr-1.5 size-4" />
                    Agendar cita
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/pacientes">Ver pacientes</Link>
                </Button>
              </div>
            </Card>
          )}

          {/* CRONOGRAMA DE HOY (TIMELINE) */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Cronograma de hoy</CardTitle>
                <CardDescription>
                  {formatShortDate(today)} • {todayAppointments.length} sesiones en total
                </CardDescription>
              </div>

              <Tabs
                value={agendaFilter}
                onValueChange={(val) => setAgendaFilter(val as typeof agendaFilter)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-2.5">
                    Todas ({todayAppointments.length})
                  </TabsTrigger>
                  <TabsTrigger value="confirmed" className="text-xs px-2.5">
                    Confirmadas ({confirmedTodayCount})
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs px-2.5">
                    Pendientes ({todayAppointments.length - confirmedTodayCount})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>

            <CardContent>
              {filteredTodayAppointments.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No hay citas que coincidan con este filtro para hoy.
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-px before:bg-border">
                  {filteredTodayAppointments.map((apt) => {
                    const patient = getPatientById(apt.patientId)
                    const isNext = nextAppointment?.id === apt.id

                    return (
                      <div key={apt.id} className="relative group">
                        {/* Indicador de nodo temporal */}
                        <div
                          className={`absolute -left-6 top-1.5 size-3 rounded-full border-2 border-background ring-1 ${
                            isNext
                              ? "bg-primary ring-primary"
                              : apt.status === AppointmentStatus.COMPLETED
                              ? "bg-muted-foreground ring-border"
                              : "bg-background ring-border"
                          }`}
                        />

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/60 bg-card p-3.5 hover:border-border hover:bg-muted/30 transition-colors">
                          <div className="flex items-start gap-3">
                            <div className="text-center shrink-0 w-16 pt-0.5">
                              <span className="block text-sm font-semibold tabular-nums text-foreground">
                                {formatAppointmentTime(new Date(apt.startTime))}
                              </span>
                              <span className="block text-[11px] text-muted-foreground">
                                {apt.durationMinutes} min
                              </span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/pacientes/${apt.patientId}`}
                                  className="font-medium text-sm text-foreground hover:text-primary hover:underline"
                                >
                                  {patient?.name ?? "Paciente"}
                                </Link>
                                {getStatusBadge(apt.status)}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
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
                                <span>•</span>
                                <span>{apt.reason || "Sesión regular"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {apt.status === AppointmentStatus.PENDING && (
                              <Button
                                size="xs"
                                variant="outline"
                                className="text-xs border-amber-300 text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/40"
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
                                className="text-xs text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  handleComplete(apt.id, patient?.name ?? "el paciente")
                                }
                              >
                                Finalizar
                              </Button>
                            )}

                            <Button size="xs" variant="ghost" asChild>
                              <Link href={`/pacientes/${apt.patientId}`}>
                                <ChevronRight className="size-4 text-muted-foreground" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>

            <CardFooter className="pt-2 border-t border-border/50 justify-between">
              <span className="text-xs text-muted-foreground">
                Zona horaria clínica: America/Mexico_City
              </span>
              <Button variant="link" size="sm" asChild className="text-xs text-primary p-0 h-auto">
                <Link href="/agenda">Ir a la agenda completa →</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* COLUMNA DERECHA: SOLICITUDES PENDIENTES & PACIENTES RECIENTES */}
        <div className="space-y-6">
          {/* BANDEJA DE SOLICITUDES POR CONFIRMAR */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="size-4 text-amber-500" />
                  Solicitudes por confirmar
                </CardTitle>
                <Badge variant="secondary" className="text-xs font-normal">
                  {pendingAppointments.length}
                </Badge>
              </div>
              <CardDescription>
                Citas agendadas por pacientes que esperan tu aprobación
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
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
                      className="rounded-lg border border-border p-3 space-y-2 bg-muted/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium text-sm text-foreground">
                            {patient?.name ?? "Paciente"}
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <CalendarDays className="size-3" />
                            <span>{formatShortDate(new Date(apt.startTime))}</span>
                            <span>•</span>
                            <span className="tabular-nums font-medium">
                              {formatAppointmentTime(new Date(apt.startTime))}
                            </span>
                          </div>
                        </div>

                        <Badge variant="outline" className="text-[10px]">
                          {apt.modality === AppointmentModality.VIRTUAL ? "Virtual" : "Presencial"}
                        </Badge>
                      </div>

                      {apt.reason && (
                        <p className="text-xs text-muted-foreground italic">
                          "{apt.reason}"
                        </p>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                        <Button
                          size="xs"
                          className="bg-primary text-primary-foreground text-xs"
                          onClick={() => handleConfirm(apt.id, patient?.name ?? "el paciente")}
                        >
                          Confirmar
                        </Button>
                        <Button variant="ghost" size="xs" asChild>
                          <Link href={`/pacientes/${apt.patientId}`}>Ficha</Link>
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* PACIENTES EN TRATAMIENTO RECIENTE */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  Pacientes recientes
                </CardTitle>
                <Button variant="link" size="sm" asChild className="text-xs p-0 h-auto">
                  <Link href="/pacientes">Ver todos</Link>
                </Button>
              </div>
              <CardDescription>
                Acceso directo a expedientes clínicos activos
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3">
              {MOCK_PATIENTS.slice(0, 3).map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar size="default" className="border border-border">
                      <AvatarFallback className="text-xs font-medium">
                        {getInitials(patient.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <Link
                        href={`/pacientes/${patient.id}`}
                        className="text-sm font-medium text-foreground hover:text-primary hover:underline line-clamp-1"
                      >
                        {patient.name}
                      </Link>
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span>{patient.gender === "femenino" ? "Mujer" : "Hombre"}</span>
                        <span>•</span>
                        <span>{patient.isMinor ? "Menor (con tutor)" : "Adulto"}</span>
                      </div>
                    </div>
                  </div>

                  <Button variant="ghost" size="xs" asChild>
                    <Link href={`/pacientes/${patient.id}`}>
                      <FileText className="size-3.5 text-muted-foreground hover:text-primary" />
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>

            <CardFooter className="pt-2 border-t border-border/40">
              <Button variant="outline" size="sm" className="w-full text-xs" asChild>
                <Link href="/agenda/nueva">
                  <Plus className="mr-1.5 size-3.5" />
                  Agendar consulta manual
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
