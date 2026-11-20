"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Plus,
  Phone,
  Mail,
  MapPin,
  User,
  Check,
  CheckCircle2,
  Lock,
  BookmarkCheck,
  Copy,
  ClipboardList,
  X,
} from "lucide-react"
import {
  AppointmentModality,
  AppointmentStatus,
  ConsentStatus,
  type Appointment,
  type ClinicalRecord,
  type Patient,
  type SessionLogEntry,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useHydrated } from "@/lib/use-hydrated"
import { GuardiansCard } from "./guardians-card"
import { formatAppointmentTime, formatShortDate } from "@/lib/format"
import {
  appointmentService,
  clinicalRecordService,
  logEntryService,
  patientService,
} from "@/services"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HojaDeSesion, LibretaSesionDialog } from "../../components/libreta-sesion"

// Mismo estilo de estado que el panel y la agenda: pastilla gris + punto de color.
const STATUS_PILL: Record<AppointmentStatus, { label: string; dot: string }> = {
  [AppointmentStatus.CONFIRMED]: { label: "Confirmada", dot: "bg-primary" },
  [AppointmentStatus.PENDING]: { label: "Pendiente", dot: "bg-amber-500" },
  [AppointmentStatus.CANCELLED]: { label: "Cancelada", dot: "bg-destructive" },
  [AppointmentStatus.COMPLETED]: { label: "Completada", dot: "bg-muted-foreground/50" },
  [AppointmentStatus.NO_SHOW]: { label: "No asistió", dot: "bg-muted-foreground/50" },
}

const CONSENT_STATUS: Record<ConsentStatus, { label: string; className: string; dot: string }> = {
  [ConsentStatus.SIGNED]: { label: "Vigente", className: "bg-primary/10 text-primary", dot: "bg-primary" },
  [ConsentStatus.EXPIRED]: {
    label: "Vencido",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/50",
  },
  [ConsentStatus.WITHDRAWN]: {
    label: "Retirado",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
}

function calculateAge(birthDate?: Date): number | null {
  if (!birthDate) return null
  // La fecha de nacimiento es un DATE (medianoche UTC): se lee en UTC para no correrla un día en Tepic.
  const today = new Date()
  let age = today.getFullYear() - birthDate.getUTCFullYear()
  const m = today.getMonth() - birthDate.getUTCMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getUTCDate())) {
    age--
  }
  return age
}

interface PatientClinicalRecordProps {
  patientId: string
}

export function PatientClinicalRecord({ patientId }: PatientClinicalRecordProps) {
  const [activeTab, setActiveTab] = React.useState<string>("datos")
  const [patient, setPatient] = React.useState<Patient | null>(null)
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [logs, setLogs] = React.useState<SessionLogEntry[]>([])
  const [record, setRecord] = React.useState<ClinicalRecord | null>(null)
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // Hoja de bitácora abierta en la libreta (una por sesión).
  const [libreta, setLibreta] = React.useState<{
    appointmentId?: string
    date: Date
    entry: SessionLogEntry | null
  } | null>(null)
  const [copiedPhone, setCopiedPhone] = React.useState<boolean>(false)
  const [successToast, setSuccessToast] = React.useState<string | null>(null)

  // Expediente, agenda y bitácora viven en la API: el detalle se resuelve en el
  // cliente porque la credencial de acceso vive en cookies que el servidor no lee aquí.
  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError(null)
      try {
        const [patientRow, appointmentRows, logRows, recordRow] = await Promise.all([
          patientService.get(patientId),
          appointmentService.list({ patientId }),
          logEntryService.list(patientId),
          clinicalRecordService.get(patientId).catch(() => null),
        ])
        if (cancelled) return
        setPatient(patientRow)
        setAppointments(appointmentRows)
        setLogs(logRows)
        setRecord(recordRow)
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "No se pudo cargar el expediente del paciente.",
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [patientId])

  const hydrated = useHydrated()
  const age = hydrated && patient ? calculateAge(patient.birthDate) : null
  const consents = record?.consents ?? []

  // La bitácora va por sesión: cada cita que ya llegó tiene (o espera) su hoja.
  // Las notas viejas sin cita se conservan como hojas sueltas.
  const sesiones = React.useMemo(() => {
    const finDeHoy = new Date()
    finDeHoy.setHours(23, 59, 59, 999)
    const deCitas = appointments
      .filter((apt) => apt.status !== AppointmentStatus.CANCELLED && apt.startTime <= finDeHoy)
      .map((apt) => ({
        key: apt.id,
        date: apt.startTime,
        appointmentId: apt.id as string | undefined,
        entry: logs.find((log) => log.appointmentId === apt.id) ?? null,
      }))
    const conCita = new Set(deCitas.map((s) => s.key))
    const sueltas = logs
      .filter((log) => !log.appointmentId || !conCita.has(log.appointmentId))
      .map((log) => ({ key: log.id, date: log.date, appointmentId: log.appointmentId, entry: log as SessionLogEntry | null }))
    return [...deCitas, ...sueltas].sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [appointments, logs])

  // Copy emergency contact phone
  const copyEmergencyPhone = (phone?: string) => {
    if (!phone) return
    navigator.clipboard.writeText(phone)
    setCopiedPhone(true)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-16" aria-busy="true">
        <div className="h-9 w-40 rounded-lg bg-muted/60 animate-pulse motion-reduce:animate-none" />
        <div className="h-48 rounded-2xl bg-muted/50 animate-pulse motion-reduce:animate-none" />
        <div className="h-64 rounded-2xl bg-muted/50 animate-pulse motion-reduce:animate-none" />
      </div>
    )
  }

  if (loadError || !patient) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-16">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 text-muted-foreground hover:text-foreground rounded-lg"
        >
          <Link href="/pacientes" className="flex items-center gap-1.5">
            <ArrowLeft className="size-4" />
            <span>Volver a Pacientes</span>
          </Link>
        </Button>
        <div
          role="alert"
          className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive"
        >
          {loadError ?? "No se encontró el paciente solicitado."}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* 1. NAVEGACIÓN SUPERIOR / RETORNO */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 text-muted-foreground hover:text-foreground rounded-lg"
        >
          <Link href="/pacientes" className="flex items-center gap-1.5">
            <ArrowLeft className="size-4" />
            <span>Volver a Pacientes</span>
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2.5 py-1 text-xs font-medium text-foreground/80">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Expediente activo
          </span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Uso Clínico Exclusivo
          </span>
        </div>
      </div>

      {/* SUCCESS TOAST BANNER */}
      {successToast && (
        <div role="status" className="p-3.5 rounded-xl bg-primary/10 text-foreground border border-primary/20 flex items-center justify-between animate-in fade-in-50">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-primary" />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="rounded-md p-0.5 text-primary hover:text-foreground"
            aria-label="Cerrar aviso"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* 2. CABECERA DE PERFIL DEL PACIENTE */}
      <Card className="border-border/70 shadow-2xs bg-card overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Información principal del Paciente */}
            <div className="flex items-start gap-4">
              <div className="size-16 rounded-2xl bg-primary/10 text-primary font-bold text-xl flex items-center justify-center shrink-0 shadow-2xs font-heading">
                {patient.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-bold font-heading text-foreground tracking-tight">
                    {patient.name}
                  </h1>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-muted text-muted-foreground border border-border/60">
                    {patient.isMinor ? "Menor de edad" : "Adulto"}
                  </span>
                  {patient.gender && (
                    <span className="text-xs px-2 py-0.5 rounded-md text-muted-foreground bg-muted/40 capitalize">
                      {patient.gender}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground">
                  {age !== null && (
                    <span className="flex items-center gap-1 font-medium text-foreground">
                      <User className="size-3.5 text-primary" />
                      {age} años
                    </span>
                  )}
                  {patient.birthDate && (
                    <span>
                      Nacimiento:{" "}
                      {patient.birthDate.toLocaleDateString("es-MX", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>
                  )}
                  <span>·</span>
                  <span>
                    Paciente desde: <strong>{formatShortDate(patient.createdAt)}</strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" />
                    {patient.email || "Sin cuenta"}
                  </span>
                  {patient.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3.5" />
                      {patient.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Botón de Acción Principal */}
            <div className="shrink-0 flex items-center gap-2">
              <Button asChild className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-10 px-4 shadow-2xs">
                <Link href={`/agenda/nueva?patientId=${patient.id}`} className="flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  <span>Agendar nueva cita</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* CAMPO RESALTADO: CONTACTO DE EMERGENCIA (Y TUTOR LEGAL) */}
          <div className="mt-6 pt-5 border-t border-border/60 grid sm:grid-cols-2 gap-3">
            {/* Contacto de Emergencia Resaltado */}
            <div className="p-3.5 rounded-xl border border-amber-300/80 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800/60 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-800 dark:text-amber-300">
                  <Phone className="size-3.5 text-amber-600" />
                  <span>Contacto de Emergencia</span>
                  <span className="text-[10px] bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-1.5 rounded-full font-bold">
                    Prioritario
                  </span>
                </div>
                {patient.emergencyContact ? (
                  <>
                    <p className="text-sm font-bold text-foreground">
                      {patient.emergencyContact.name}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({patient.emergencyContact.relationship})
                      </span>
                    </p>
                    <p className="text-xs font-mono font-medium text-amber-950 dark:text-amber-200">
                      {patient.emergencyContact.phone}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin contacto de emergencia registrado.</p>
                )}
              </div>

              {patient.emergencyContact?.phone && (
                <button
                  type="button"
                  onClick={() => copyEmergencyPhone(patient.emergencyContact?.phone)}
                  className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 text-xs font-medium transition-colors shrink-0 flex items-center gap-1"
                  title="Copiar teléfono"
                >
                  {copiedPhone ? (
                    <>
                      <Check className="size-3" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Tutores: solo mientras el paciente es menor de edad */}
            {patient.isMinor ? (
              <GuardiansCard patientId={patient.id} initial={patient.guardians ?? []} />
            ) : (
              <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-between">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-muted-foreground">Ubicación y Domicilio</span>
                  <p className="text-xs font-medium text-foreground">
                    {patient.address || "Ciudad de México, México"}
                  </p>
                </div>
                <MapPin className="size-4 text-muted-foreground" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. NAVEGACIÓN INTERNA (PESTAÑAS) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-2">
          {/* El indicador (color primario) se desliza entre pestañas; la lista hace scroll si no cabe. */}
          <TabsList className="border border-border/60" wrapperClassName="min-w-0 max-w-full">
            <TabsTrigger value="datos" className="text-xs font-semibold">
              Información General y Antecedentes
            </TabsTrigger>
            <TabsTrigger value="bitacora" className="text-xs font-semibold">
              Bitácora de Sesiones ({logs.length})
            </TabsTrigger>
            <TabsTrigger value="citas" className="text-xs font-semibold">
              Historial de Citas ({appointments.length})
            </TabsTrigger>
          </TabsList>

        </div>

        {/* ==================== PESTAÑA 1: DATOS GENERALES ==================== */}
        <TabsContent value="datos" className="space-y-6 pt-1">
          {/* Card: Diagnóstico Inicial y Motivo Clínico */}
          <Card className="border-border/70 shadow-2xs bg-card">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
              <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
                <BookmarkCheck className="size-4 text-primary" />
                <span>Diagnóstico Clínico Inicial</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Impresión diagnóstica principal establecida al inicio del proceso terapéutico.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {record ? (
                <>
                  <div className="p-4 rounded-xl bg-primary/[0.03] border border-primary/20 space-y-1">
                    <span className="text-xs font-medium text-primary">
                      Trastorno Diagnósticado
                    </span>
                    <p className="text-base font-bold text-foreground">
                      {record.diagnosis || "Sin diagnóstico registrado"}
                    </p>
                    <p className="text-xs text-muted-foreground pt-1">
                      Apertura oficial del expediente: <strong>{formatShortDate(record.openedAt)}</strong> · Última revisión: <strong>{formatShortDate(record.updatedAt)}</strong>
                    </p>
                  </div>

                  {/* Antecedentes clínicos y familiares */}
                  <div className="space-y-1.5 pt-2">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="size-3.5 text-muted-foreground" />
                      <span>Antecedentes Clínicos y Familiares</span>
                    </h4>
                    <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs text-foreground leading-relaxed">
                      {record.background || "Sin antecedentes registrados."}
                    </div>
                  </div>

                  {/* Observaciones Generales */}
                  <div className="space-y-1.5 pt-2">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <ClipboardList className="size-3.5 text-muted-foreground" />
                      <span>Observaciones Generales de Evolución</span>
                    </h4>
                    <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs text-foreground leading-relaxed">
                      {record.generalObservations || "Sin observaciones registradas."}
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                  Aún no hay un expediente clínico abierto para este paciente.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consentimiento Informado y Marco Legal */}
          <Card className="border-border/70 shadow-2xs bg-card">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
              <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
                <Lock className="size-4 text-primary" />
                <span>Consentimiento Informado y Protección de Datos</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {consents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                  Aún no hay consentimientos informados registrados para este paciente.
                </div>
              ) : (
                consents.map((consent) => {
                  const estado = CONSENT_STATUS[consent.status]
                  return (
                    <div
                      key={consent.id}
                      className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`size-2 rounded-full ${estado.dot}`} aria-hidden="true" />
                          <span className="text-xs font-semibold text-foreground">
                            Consentimiento {estado.label.toLowerCase()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground max-w-xl">
                          Firmado el {formatShortDate(consent.signedAt)} por{" "}
                          <strong className="font-semibold text-foreground">
                            {consent.legalGuardian?.name ?? "el propio paciente"}
                          </strong>
                          {consent.legalGuardian ? " (tutor legal)" : ""}.
                          {consent.withdrawnAt
                            ? ` Retirado el ${formatShortDate(consent.withdrawnAt)}.`
                            : ""}
                        </p>
                        {consent.documentUrl ? (
                          <Link
                            href={consent.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Ver documento
                          </Link>
                        ) : null}
                      </div>

                      <span
                        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estado.className}`}
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        {estado.label}
                      </span>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== PESTAÑA 2: BITÁCORA, UNA HOJA POR SESIÓN ==================== */}
        <TabsContent value="bitacora" className="space-y-4 pt-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Una hoja por cada sesión, de la más reciente a la más antigua.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLibreta({ date: new Date(), entry: null })}
            >
              <Plus />
              Nota sin cita
            </Button>
          </div>

          {sesiones.length === 0 ? (
            <p className="rounded-[18px] border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
              Todavía no hay sesiones. Cuando llegue la primera cita, aquí aparecerá su hoja para escribir.
            </p>
          ) : (
            sesiones.map((sesion) =>
              sesion.entry ? (
                <HojaDeSesion key={sesion.key} entry={sesion.entry} onEdit={() => setLibreta(sesion)} />
              ) : (
                <div
                  key={sesion.key}
                  className="flex flex-col gap-3 rounded-[18px] border border-dashed border-border bg-card px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {formatShortDate(sesion.date)} · {formatAppointmentTime(sesion.date)}
                    </p>
                    <p className="text-sm text-muted-foreground">Esta sesión aún no tiene hoja.</p>
                  </div>
                  <Button type="button" size="sm" onClick={() => setLibreta(sesion)}>
                    <FileText />
                    Escribir hoja
                  </Button>
                </div>
              ),
            )
          )}
        </TabsContent>

        {/* ==================== PESTAÑA 3: HISTORIAL DE CITAS ==================== */}
        <TabsContent value="citas" className="space-y-3 pt-1">
          {appointments.length > 0 ? (
            appointments.map((apt) => (
              <Card key={apt.id} className="border-border/70 shadow-2xs bg-card hover:border-primary/40 transition-all">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-foreground">
                        {formatShortDate(apt.startTime)} · {formatAppointmentTime(apt.startTime)}
                      </span>
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {apt.modality === AppointmentModality.IN_PERSON ? "Presencial" : "Virtual"}
                      </Badge>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                        <span className={`size-1.5 rounded-full ${STATUS_PILL[apt.status].dot}`} aria-hidden="true" />
                        {STATUS_PILL[apt.status].label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Motivo: {apt.reason || "Consulta psicológica"} · Duración: {apt.durationMinutes} min
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setLibreta({
                          appointmentId: apt.id,
                          date: apt.startTime,
                          entry: logs.find((log) => log.appointmentId === apt.id) ?? null,
                        })
                      }
                      className="h-8 text-xs rounded-lg border-border/80 hover:border-primary/50"
                    >
                      <FileText className="size-3.5 mr-1 text-primary" />
                      Documentar en Bitácora
                    </Button>
                    <Button variant="ghost" size="sm" asChild className="h-8 text-xs">
                      <Link href={`/agenda/${apt.id}`}>
                        Gestionar
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
              No hay citas programadas para este paciente.
            </div>
          )}
        </TabsContent>
      </Tabs>

      {libreta && (
        <LibretaSesionDialog
          key={libreta.entry?.id ?? libreta.appointmentId ?? "suelta"}
          open
          onOpenChange={(open) => !open && setLibreta(null)}
          patientId={patientId}
          patientName={patient?.name}
          appointmentId={libreta.appointmentId}
          sessionDate={libreta.date}
          entry={libreta.entry}
          onSaved={(saved, created) =>
            setLogs((prev) => (created ? [saved, ...prev] : prev.map((log) => (log.id === saved.id ? saved : log))))
          }
        />
      )}
    </div>
  )
}
