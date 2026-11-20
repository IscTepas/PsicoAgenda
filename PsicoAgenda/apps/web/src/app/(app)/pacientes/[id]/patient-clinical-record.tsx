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
  Copy,
  X,
  Search,
  ChevronDown,
  Siren,
  Edit3,
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
import { Badge } from "@/components/ui/badge"
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
import { Card, CardContent } from "@/components/ui/card"
import { HojaDeSesion, LibretaSesionDialog } from "../../components/libreta-sesion"
import { AccesosExpediente } from "./accesos-expediente"
import { Caratula } from "./caratula"
import { ConfirmarConContrasena } from "./confirmar-contrasena"
import { ConsentimientoCard } from "./consentimiento-card"
import { HistoriaClinica } from "./historia-clinica"
import { NotaEspecialDialog, type TipoNotaEspecial } from "./nota-especial-dialog"

// Mismo estilo de estado que el panel y la agenda: pastilla gris + punto de color.
const STATUS_PILL: Record<AppointmentStatus, { label: string; dot: string }> = {
  [AppointmentStatus.CONFIRMED]: { label: "Confirmada", dot: "bg-primary" },
  [AppointmentStatus.PENDING]: { label: "Pendiente", dot: "bg-amber-500" },
  [AppointmentStatus.CANCELLED]: { label: "Cancelada", dot: "bg-destructive" },
  [AppointmentStatus.COMPLETED]: { label: "Completada", dot: "bg-muted-foreground/50" },
  [AppointmentStatus.NO_SHOW]: { label: "No asistió", dot: "bg-muted-foreground/50" },
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
  // Acciones sobre notas: cerrar (sellar), aclarar una cerrada y notas especiales.
  const [cerrarNotaId, setCerrarNotaId] = React.useState<string | null>(null)
  const [aclararNotaId, setAclararNotaId] = React.useState<string | null>(null)
  const [notaEspecial, setNotaEspecial] = React.useState<TipoNotaEspecial | null>(null)
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
  const faltaParaEvolucion = [
    !consents.some((c) => c.status === ConsentStatus.SIGNED) && "el consentimiento informado firmado",
    record?.historyStatus !== "closed" && "la historia clínica cerrada",
  ].filter((x): x is string => Boolean(x))
  const reemplazarNota = (nota: SessionLogEntry) =>
    setLogs((prev) => (prev.some((l) => l.id === nota.id) ? prev.map((l) => (l.id === nota.id ? nota : l)) : [nota, ...prev]))
  // Una nota nueva puede cambiar el número de sesión de las demás: se vuelve a pedir la lista.
  const recargarNotas = async () => setLogs(await logEntryService.list(patientId))

  // La bitácora va por sesión: cada cita que ya llegó tiene (o espera) su hoja.
  // Las notas viejas sin cita se conservan como hojas sueltas.
  // Solo las hojas escritas: las sesiones que aún no tienen hoja se piden desde Inicio ("Pendientes").
  const [buscarHoja, setBuscarHoja] = React.useState("")
  const aclaracionesDe = React.useMemo(() => {
    const mapa = new Map<string, SessionLogEntry[]>()
    for (const log of logs) {
      if (log.kind !== "clarification" || !log.parentId) continue
      mapa.set(log.parentId, [...(mapa.get(log.parentId) ?? []), log].sort((a, b) => a.date.getTime() - b.date.getTime()))
    }
    return mapa
  }, [logs])
  const hojas = React.useMemo(() => {
    const q = buscarHoja.trim().toLowerCase()
    return [...logs]
      .filter((log) => log.kind !== "clarification")
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
              Expediente
            </TabsTrigger>
            <TabsTrigger value="bitacora" className="text-xs font-semibold">
              Bitácora ({hojas.length})
            </TabsTrigger>
            <TabsTrigger value="citas" className="text-xs font-semibold">
              Citas ({appointments.length})
            </TabsTrigger>
            <TabsTrigger value="accesos" className="text-xs font-semibold">
              Accesos
            </TabsTrigger>
          </TabsList>

        </div>

        {/* ==================== PESTAÑA 1: DATOS GENERALES ==================== */}
        <TabsContent value="datos" className="space-y-6 pt-1">
          {record ? (
            <>
              <Caratula patient={patient} record={record} onRecord={setRecord} />
              {/* Consentimiento primero: es lo que se firma antes de iniciar la terapia. */}
              <ConsentimientoCard patient={patient} consents={consents} onRecord={setRecord} />
              <HistoriaClinica patientId={patientId} record={record} onRecord={setRecord} />
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 text-center text-xs text-muted-foreground">
              No se pudo abrir el expediente clínico de este paciente.
            </div>
          )}
        </TabsContent>

        {/* ==================== PESTAÑA 2: BITÁCORA, UNA HOJA POR SESIÓN ==================== */}
        <TabsContent value="bitacora" className="space-y-4 pt-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Una hoja por sesión. Se escribe en borrador y se cierra con tu contraseña; cerrada ya no se modifica.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setNotaEspecial("referral")}>
                Interconsulta
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setNotaEspecial("discharge")}>
                Egreso
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={faltaParaEvolucion.length > 0}
                onClick={() => setLibreta({ date: new Date(), entry: null })}
              >
                <Plus />
                Nota sin cita
              </Button>
            </div>
          </div>

          {faltaParaEvolucion.length > 0 && (
            <p role="status" className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Para escribir notas de evolución falta {faltaParaEvolucion.join(" y ")}.</span>{" "}
              <button type="button" onClick={() => setActiveTab("datos")} className="font-medium text-primary hover:underline">
                Ir al expediente
              </button>
            </p>
          )}

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
                          <span className="block text-xs text-muted-foreground">
                            {log.kind === "referral" ? "Interconsulta" : log.kind === "discharge" ? "Egreso" : `Sesión ${log.sessionNumber}`}
                          </span>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {log.notes.split("\n")[0]}
                        </span>
                        {tareas.length > 0 && (
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                            {pendientes > 0 ? `${pendientes} de ${tareas.length} tareas pendientes` : `${tareas.length} tareas hechas`}
                          </span>
                        )}
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${log.status === "closed" ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}
                        >
                          {log.status === "closed" ? "Cerrada" : "Borrador"}
                        </span>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <div className="border-t border-border/60 bg-muted/10 p-4">
                        <HojaDeSesion
                          entry={log}
                          acciones={
                            log.status === "draft" ? (
                              <div className="flex gap-1">
                                {log.kind === "evolution" && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground"
                                    onClick={() => setLibreta({ appointmentId: log.appointmentId, date: log.date, entry: log })}
                                  >
                                    <Edit3 />
                                    Editar
                                  </Button>
                                )}
                                <Button type="button" size="sm" onClick={() => setCerrarNotaId(log.id)}>
                                  <Lock />
                                  Cerrar nota
                                </Button>
                              </div>
                            ) : (
                              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAclararNotaId(log.id)}>
                                <Plus />
                                Nota aclaratoria
                              </Button>
                            )
                          }
                        >
                          {log.status === "closed" && (
                            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                              Cerrada por {log.closedByName ?? log.psychologistName}
                              {log.closedByLicense ? `, cédula ${log.closedByLicense}` : ""} el{" "}
                              {log.closedAt?.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })} · sello{" "}
                              <span className="font-mono">{log.hash?.slice(0, 16)}…</span>
                            </p>
                          )}
                          {(aclaracionesDe.get(log.id) ?? []).map((a) => (
                            <div key={a.id} className="mt-3 rounded-lg border-l-2 border-amber-500/60 bg-muted/30 px-3 py-2">
                              <p className="text-xs font-medium text-foreground">
                                Nota aclaratoria · {a.date.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                              </p>
                              <p className="whitespace-pre-wrap text-sm text-foreground">{a.notes}</p>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {a.closedByName}
                                {a.closedByLicense ? `, cédula ${a.closedByLicense}` : ""} · sello{" "}
                                <span className="font-mono">{a.hash?.slice(0, 16)}…</span>
                              </p>
                            </div>
                          ))}
                        </HojaDeSesion>
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
        {/* ==================== PESTAÑA 4: BITÁCORA DE AUDITORÍA ==================== */}
        <TabsContent value="accesos" className="pt-1">
          {activeTab === "accesos" && <AccesosExpediente patientId={patientId} />}
        </TabsContent>
      </Tabs>

      <ConfirmarConContrasena
        open={cerrarNotaId !== null}
        onOpenChange={(v) => !v && setCerrarNotaId(null)}
        titulo="Cerrar nota"
        descripcion="Se sellará con tu nombre, cédula y la hora del servidor. Después ya no se podrá modificar; las correcciones van en una nota aclaratoria."
        accion="Cerrar y sellar"
        onConfirmar={async (password) => {
          if (!cerrarNotaId) return
          reemplazarNota(await logEntryService.cerrar(cerrarNotaId, password))
          // Cerrar el egreso cambia el estado del expediente.
          setRecord(await clinicalRecordService.get(patientId))
        }}
      />
      <ConfirmarConContrasena
        open={aclararNotaId !== null}
        onOpenChange={(v) => !v && setAclararNotaId(null)}
        titulo="Nota aclaratoria"
        descripcion="Queda ligada a la nota original, que no cambia. Se sella al guardarla."
        accion="Guardar y sellar"
        conTexto
        onConfirmar={async (password, texto) => {
          if (!aclararNotaId) return
          reemplazarNota(await logEntryService.aclarar(aclararNotaId, texto, password))
        }}
      />
      <NotaEspecialDialog
        tipo={notaEspecial}
        patientId={patientId}
        onOpenChange={(v) => !v && setNotaEspecial(null)}
        onSaved={() => void recargarNotas()}
      />

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
          onSaved={(saved, created) => (created ? void recargarNotas() : reemplazarNota(saved))}
        />
      )}
    </div>
  )
}
