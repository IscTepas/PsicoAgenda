"use client"

import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
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
  X,
  Search,
  ChevronDown,
  Siren,
  Edit3,
  Loader2,
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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { WheelDatePicker } from "@/components/wheel-date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select"
import { useHydrated } from "@/lib/use-hydrated"
import { GuardiansCard } from "./guardians-card"
import { InvitarCuenta } from "./invitar-cuenta"
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
  /** Dentro de la ficha de Pacientes: sin "Volver" ni la cabecera con nombre (ya están arriba). */
  embebido?: boolean
}

export function PatientClinicalRecord({ patientId, embebido = false }: PatientClinicalRecordProps) {
  const queryClient = useQueryClient()
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
          // Misma clave que la ficha de Pacientes: si ya lo pidió (o lo está pidiendo), no se repite.
          queryClient.fetchQuery({
            queryKey: ["patients", "detalle", patientId],
            queryFn: () => patientService.get(patientId),
            staleTime: 60_000,
          }),
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
  }, [patientId, queryClient])

  const hydrated = useHydrated()
  const age = hydrated && patient ? calculateAge(patient.birthDate) : null
  const consents = record?.consents ?? []

  // La bitácora va por sesión: cada cita que ya llegó tiene (o espera) su hoja.
  // Las notas viejas sin cita se conservan como hojas sueltas.
  // Solo las hojas escritas: las sesiones que aún no tienen hoja se piden desde Inicio ("Pendientes").
  const [buscarHoja, setBuscarHoja] = React.useState("")
  const hojas = React.useMemo(() => {
    const q = buscarHoja.trim().toLowerCase()
    return [...logs]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .filter(
        (log) =>
          !q ||
          [log.notes, log.interventions, log.homework, ...(log.tasks ?? []).map((t) => t.text)]
            .filter(Boolean)
            .some((t) => t!.toLowerCase().includes(q)),
      )
  }, [logs, buscarHoja])

  // Copy emergency contact phone
  const copyEmergencyPhone = (phone?: string) => {
    if (!phone) return
    navigator.clipboard.writeText(phone)
    setCopiedPhone(true)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  if (isLoading && embebido) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Cargando expediente">
        <div className="h-9 w-72 rounded-full bg-muted/50 animate-pulse motion-reduce:animate-none" />
        <div className="h-40 rounded-xl bg-muted/40 animate-pulse motion-reduce:animate-none" />
      </div>
    )
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
    <div
      className={
        embebido
          ? "space-y-5 [&_[data-slot=card]]:gap-3 [&_[data-slot=card]]:rounded-none [&_[data-slot=card]]:border-0 [&_[data-slot=card]]:bg-transparent [&_[data-slot=card]]:py-0 [&_[data-slot=card]]:shadow-none [&_[data-slot=card]]:ring-0 [&_[data-slot=card-content]]:px-0 [&_[data-slot=card-header]]:border-0 [&_[data-slot=card-header]]:bg-transparent [&_[data-slot=card-header]]:px-0 [&_[data-slot=card-header]]:pb-0"
          : "space-y-6 max-w-5xl mx-auto pb-16"
      }
    >
      {/* 1. NAVEGACIÓN SUPERIOR / RETORNO */}
      <div className={embebido ? "hidden" : "flex items-center justify-between"}>
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
      {embebido ? (
        patient.isMinor && <GuardiansCard patientId={patient.id} initial={patient.guardians ?? []} />
      ) : (
      <Card className="border-border/70 shadow-2xs bg-card overflow-hidden">
        <CardContent className="p-6">
          <div className={embebido ? "hidden" : "flex flex-col md:flex-row md:items-start md:justify-between gap-6"}>
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
                  {patient.oneTime && (
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-primary/10 text-primary">Cita única · sin cuenta</span>
                  )}
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
                  {patient.birthDate && <span>·</span>}
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
            <div className="shrink-0 flex flex-wrap items-center gap-2">
              {patient.oneTime && <InvitarCuenta pacienteId={patient.id} nombre={patient.name} telefono={patient.phone} />}
              <Button asChild className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs h-10 px-4 shadow-2xs">
                <Link href={`/agenda/nueva?patientId=${patient.id}`} className="flex items-center gap-2">
                  <CalendarDays className="size-4" />
                  <span>Nueva cita</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* CAMPO RESALTADO: CONTACTO DE EMERGENCIA (Y TUTOR LEGAL) */}
          <div className={embebido ? "grid sm:grid-cols-2 gap-3" : "mt-6 pt-5 border-t border-border/60 grid sm:grid-cols-2 gap-3"}>
            {/* Contacto de Emergencia Resaltado */}
            <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <Siren className="size-3.5" aria-hidden="true" />
                  <span>Contacto de emergencia</span>
                </div>
                {patient.emergencyContact ? (
                  <>
                    <p className="text-sm font-bold text-foreground">
                      {patient.emergencyContact.name}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({patient.emergencyContact.relationship})
                      </span>
                    </p>
                    <p className="text-sm tabular-nums text-muted-foreground">
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
                  className="px-2.5 py-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-medium transition-colors shrink-0 flex items-center gap-1"
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
                    {patient.address || "Sin domicilio registrado"}
                  </p>
                </div>
                <MapPin className="size-4 text-muted-foreground" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {/* 3. NAVEGACIÓN INTERNA (PESTAÑAS) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className={embebido ? "flex items-center" : "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-2"}>
          {/* El indicador (color primario) se desliza entre pestañas; la lista hace scroll si no cabe. */}
          <TabsList className="border border-border/60" wrapperClassName="min-w-0 max-w-full">
            <TabsTrigger value="datos" className="text-xs font-semibold">
              Antecedentes
            </TabsTrigger>
            <TabsTrigger value="bitacora" className="text-xs font-semibold">
              Bitácora ({logs.length})
            </TabsTrigger>
            <TabsTrigger value="citas" className="text-xs font-semibold">
              Citas ({appointments.length})
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
                <span>Diagnóstico y antecedentes</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Solo tú lo ves. Toca «Editar» en cada apartado para escribirlo.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {record ? (
                <>
                  <CampoDelExpediente
                    titulo="Diagnóstico"
                    valor={record.diagnosis}
                    vacio="Sin diagnóstico registrado."
                    max={500}
                    filas={2}
                    onGuardar={async (v) => setRecord(await clinicalRecordService.update(patientId, { diagnosis: v }))}
                  />
                  <CampoDelExpediente
                    titulo="Antecedentes clínicos y familiares"
                    valor={record.background}
                    vacio="Sin antecedentes registrados."
                    max={5000}
                    onGuardar={async (v) => setRecord(await clinicalRecordService.update(patientId, { background: v }))}
                  />
                  <CampoDelExpediente
                    titulo="Observaciones generales"
                    valor={record.generalObservations}
                    vacio="Sin observaciones registradas."
                    max={5000}
                    onGuardar={async (v) =>
                      setRecord(await clinicalRecordService.update(patientId, { generalObservations: v }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Expediente abierto el {formatShortDate(record.openedAt)} · última revisión {formatShortDate(record.updatedAt)}
                  </p>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                  Aún no hay un expediente clínico abierto para este paciente.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Consentimiento informado: se registra la firma y se puede retirar. */}
          <ConsentimientoCard patient={patient} consents={consents} onRecord={setRecord} />
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

          {logs.length > 4 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                value={buscarHoja}
                onChange={(e) => setBuscarHoja(e.target.value)}
                placeholder="Buscar en la bitácora"
                aria-label="Buscar en la bitácora"
                className="h-10 rounded-xl pl-9"
              />
            </div>
          )}

          {logs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
              Aún no hay hojas de bitácora. Se escriben al atender cada sesión.
            </p>
          ) : hojas.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">Ninguna hoja coincide con «{buscarHoja}».</p>
          ) : (
            // Un renglón por sesión; se despliega para leer la hoja completa. Así 50 sesiones caben en una pantalla.
            <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {hojas.map((log, idx) => {
                const tareas = log.tasks ?? []
                const pendientes = tareas.filter((t) => !t.doneAt).length
                return (
                  <li key={log.id}>
                    <details className="group" open={idx === 0 && !buscarHoja ? true : undefined}>
                      <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-3 outline-none transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 [&::-webkit-details-marker]:hidden">
                        <span className="w-28 shrink-0 text-sm">
                          <span className="block font-medium tabular-nums text-foreground">
                            {log.date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <span className="block text-xs text-muted-foreground">Sesión {log.sessionNumber}</span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {log.notes.split("\n")[0]}
                        </span>
                        {tareas.length > 0 && (
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                            {pendientes > 0 ? `${pendientes} de ${tareas.length} tareas pendientes` : `${tareas.length} tareas hechas`}
                          </span>
                        )}
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <div className="border-t border-border/60 bg-muted/10 p-4">
                        <HojaDeSesion
                          entry={log}
                          onEdit={() => setLibreta({ appointmentId: log.appointmentId, date: log.date, entry: log })}
                        />
                      </div>
                    </details>
                  </li>
                )
              })}
            </ol>
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

/** Un apartado del expediente: se lee y, con «Editar», se escribe ahí mismo. */
function CampoDelExpediente({
  titulo,
  valor,
  vacio,
  max,
  filas = 4,
  onGuardar,
}: {
  titulo: string
  valor?: string
  vacio: string
  max: number
  filas?: number
  onGuardar: (valor: string) => Promise<void>
}) {
  const [editando, setEditando] = React.useState(false)
  const [texto, setTexto] = React.useState(valor ?? "")
  const [guardando, setGuardando] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const id = React.useId()

  const guardar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await onGuardar(texto.trim())
      setEditando(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <h4 id={id} className="text-sm font-semibold text-foreground">{titulo}</h4>
        {!editando && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground"
            onClick={() => {
              setTexto(valor ?? "")
              setEditando(true)
            }}
          >
            <Edit3 className="size-3.5" />
            Editar
          </Button>
        )}
      </div>
      {editando ? (
        <div className="space-y-2">
          <Textarea
            aria-labelledby={id}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={filas}
            maxLength={max}
            autoFocus
            disabled={guardando}
            className="rounded-xl text-sm"
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={guardando} onClick={() => setEditando(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" disabled={guardando} aria-busy={guardando} onClick={() => void guardar()}>
              {guardando && <Loader2 className="size-3.5 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <p className={`whitespace-pre-line rounded-xl bg-muted/20 p-3.5 text-sm leading-relaxed ${valor ? "text-foreground" : "text-muted-foreground"}`}>
          {valor || vacio}
        </p>
      )}
    </section>
  )
}

const DOCUMENTO_BASE = "Consentimiento informado para atención psicológica"
const hoyIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/**
 * Consentimiento informado del paciente. La psicóloga lo da a firmar en papel
 * (o en el consultorio) y aquí registra cuándo y quién lo firmó; un menor lo
 * firma su tutor. Si el paciente lo retira, se marca y queda el historial.
 */
function ConsentimientoCard({
  patient,
  consents,
  onRecord,
}: {
  patient: Patient
  consents: ClinicalRecord["consents"]
  onRecord: (record: ClinicalRecord) => void
}) {
  const tutores = patient.isMinor ? (patient.guardians ?? []) : []
  const vigente = consents.find((c) => c.status === ConsentStatus.SIGNED)
  const [abierto, setAbierto] = React.useState(false)
  const [fecha, setFecha] = React.useState(hoyIso)
  const [documento, setDocumento] = React.useState(DOCUMENTO_BASE)
  const [tutorId, setTutorId] = React.useState(tutores.find((t) => t.isPrimary)?.id ?? tutores[0]?.id ?? "")
  const [guardando, setGuardando] = React.useState(false)
  const [confirmarRetiro, setConfirmarRetiro] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const ejecutar = async (accion: () => Promise<ClinicalRecord>) => {
    setGuardando(true)
    setError(null)
    try {
      onRecord(await accion())
      setAbierto(false)
      setConfirmarRetiro(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.")
    } finally {
      setGuardando(false)
    }
  }

  const sinTutor = patient.isMinor && tutores.length === 0

  return (
    <Card className="border-border/70 shadow-2xs bg-card">
      <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
            <Lock className="size-4 text-primary" />
            <span>Consentimiento informado</span>
          </CardTitle>
          {!abierto && (
            <Button type="button" size="sm" variant={vigente ? "ghost" : "default"} onClick={() => setAbierto(true)} disabled={sinTutor}>
              <Plus className="size-3.5" />
              {vigente ? "Registrar uno nuevo" : "Registrar firma"}
            </Button>
          )}
        </div>
        <CardDescription className="text-xs text-muted-foreground">
          {vigente
            ? `Vigente desde el ${formatShortDate(vigente.signedAt)}.`
            : sinTutor
              ? "Es menor de edad: agrega primero a su tutor para que firme."
              : "Sin consentimiento vigente. Dalo a firmar antes de la primera sesión y regístralo aquí."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {abierto && (
          <form
            className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4"
            onSubmit={(e) => {
              e.preventDefault()
              void ejecutar(() =>
                clinicalRecordService.registrarConsentimiento(patient.id, {
                  signedAt: fecha,
                  document: documento.trim(),
                  guardianId: patient.isMinor ? tutorId : undefined,
                }),
              )
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="consentimiento-fecha">Fecha de firma</Label>
                <WheelDatePicker
                  id="consentimiento-fecha"
                  value={fecha}
                  onChange={setFecha}
                  defaultYear={new Date().getFullYear()}
                  fromYear={new Date().getFullYear() - 5}
                  toYear={new Date().getFullYear()}
                  invalid={fecha > hoyIso()}
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="consentimiento-firmante">Firmó</Label>
                {patient.isMinor ? (
                  <Select value={tutorId} onValueChange={setTutorId} className="w-full">
                    <SelectTrigger id="consentimiento-firmante" className="h-10 rounded-xl text-sm">
                      <SelectValue placeholder="Elige al tutor" />
                    </SelectTrigger>
                    <SelectContent>
                      {tutores.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.relationship ? `${t.name} (${t.relationship})` : t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input id="consentimiento-firmante" value={`${patient.name} (el propio paciente)`} readOnly className="h-10 rounded-xl text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consentimiento-documento">Documento</Label>
              <Input
                id="consentimiento-documento"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                required
                minLength={3}
                maxLength={200}
                className="h-10 rounded-xl"
              />
            </div>
            {fecha > hoyIso() && <p role="alert" className="text-sm text-destructive">La fecha de firma no puede ser futura.</p>}
            {vigente && (
              <p className="text-xs text-muted-foreground">El consentimiento vigente pasará a vencido y quedará en el historial.</p>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" disabled={guardando} onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={guardando || fecha > hoyIso()} aria-busy={guardando}>
                {guardando && <Loader2 className="size-3.5 animate-spin" />}
                Guardar firma
              </Button>
            </div>
          </form>
        )}

        {consents.length === 0 && !abierto ? (
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-4 text-center text-xs text-muted-foreground">
            Aún no hay consentimientos registrados.
          </p>
        ) : (
          consents.map((consent) => {
            const estado = CONSENT_STATUS[consent.status]
            const esVigente = consent.status === ConsentStatus.SIGNED
            return (
              <div
                key={consent.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${estado.dot}`} aria-hidden="true" />
                    <span className="text-xs font-semibold text-foreground">{consent.document}</span>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    Firmado el {formatShortDate(consent.signedAt)} por{" "}
                    <strong className="font-semibold text-foreground">
                      {consent.legalGuardian?.name ?? "el propio paciente"}
                    </strong>
                    {consent.legalGuardian ? " (tutor legal)" : ""}.
                    {consent.withdrawnAt ? ` Retirado el ${formatShortDate(consent.withdrawnAt)}.` : ""}
                  </p>
                  {consent.documentUrl ? (
                    <Link href={consent.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline">
                      Ver documento
                    </Link>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {esVigente &&
                    (confirmarRetiro ? (
                      <>
                        <span className="text-xs text-muted-foreground">¿Lo retiró?</span>
                        <Button type="button" size="sm" variant="ghost" disabled={guardando} onClick={() => setConfirmarRetiro(false)}>
                          No
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={guardando}
                          onClick={() => void ejecutar(() => clinicalRecordService.retirarConsentimiento(patient.id, consent.id))}
                        >
                          Sí, retirar
                        </Button>
                      </>
                    ) : (
                      <Button type="button" size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setConfirmarRetiro(true)}>
                        Retirar
                      </Button>
                    ))}
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${estado.className}`}>
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    {estado.label}
                  </span>
                </div>
              </div>
            )
          })
        )}
        {error && !abierto && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
