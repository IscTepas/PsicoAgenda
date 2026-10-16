"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  FileText,
  Plus,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Video,
  User,
  Check,
  CheckCircle2,
  Lock,
  Edit3,
  BookmarkCheck,
  Copy,
  ClipboardList,
  Save,
  Bookmark,
  X,
} from "lucide-react"
import {
  AppointmentModality,
  AppointmentStatus,
  type Appointment,
  type ClinicalRecord,
  type Patient,
  type PsychologistProfile,
  type SessionLogEntry,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { useHydrated } from "@/lib/use-hydrated"
import { formatAppointmentTime, formatShortDate } from "@/lib/format"
import {
  appointmentService,
  clinicalRecordService,
  logEntryService,
  patientService,
  psychologistService,
} from "@/services"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"

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
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const m = today.getMonth() - birthDate.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
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
  const [psychologist, setPsychologist] = React.useState<PsychologistProfile | null>(null)
  const [isLoading, setIsLoading] = React.useState<boolean>(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  // Bitacora modal state
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false)
  const [editingLog, setEditingLog] = React.useState<SessionLogEntry | null>(null)
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string>("")
  const [sessionType, setSessionType] = React.useState<string>("Seguimiento terapéutico")
  const [sessionNotes, setSessionNotes] = React.useState<string>("")
  const [interventions, setInterventions] = React.useState<string>("")
  const [homework, setHomework] = React.useState<string>("")
  const [formError, setFormError] = React.useState<string>("")
  const [isSaving, setIsSaving] = React.useState<boolean>(false)
  const [hasDraft, setHasDraft] = React.useState<boolean>(false)
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
        const [patientRow, appointmentRows, logRows, recordRow, therapist] = await Promise.all([
          patientService.get(patientId),
          appointmentService.list({ patientId }),
          logEntryService.list(patientId),
          clinicalRecordService.get(patientId).catch(() => null),
          psychologistService.getMe().catch(() => null),
        ])
        if (cancelled) return
        setPatient(patientRow)
        setAppointments(appointmentRows)
        setLogs(logRows)
        setRecord(recordRow)
        setPsychologist(therapist)
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

  // Associated session date for modal read-only field
  const associatedAppointment = React.useMemo(() => {
    if (selectedAppointmentId) {
      return appointments.find((a) => a.id === selectedAppointmentId)
    }
    // Default to latest past or current appointment
    return appointments[0] || null
  }, [selectedAppointmentId, appointments])

  const sessionDateString = React.useMemo(() => {
    if (editingLog) {
      return `${formatShortDate(editingLog.date)} — ${formatAppointmentTime(editingLog.date)} hrs (Sesión #${editingLog.sessionNumber})`
    }
    if (associatedAppointment) {
      return `${formatShortDate(associatedAppointment.startTime)} — ${formatAppointmentTime(associatedAppointment.startTime)} hrs (Cita #${associatedAppointment.id})`
    }
    const now = new Date()
    return `${formatShortDate(now)} — ${formatAppointmentTime(now)} hrs (Sesión #${logs.length + 1})`
  }, [editingLog, associatedAppointment, logs])

  // Borrador de bitácora: permite guardar una entrada a medio escribir y
  // reanudarla después sin perderla, sin "sellarla" todavía en el expediente.
  const draftKey = (key: string) => `psicoagenda-bitacora-draft-${patientId}-${key}`

  type BitacoraDraft = {
    sessionType: string
    sessionNotes: string
    interventions: string
    homework: string
  }

  const readDraft = (key: string): BitacoraDraft | null => {
    if (typeof window === "undefined") return null
    try {
      const raw = window.localStorage.getItem(draftKey(key))
      return raw ? (JSON.parse(raw) as BitacoraDraft) : null
    } catch {
      return null
    }
  }

  const clearDraft = (key: string) => {
    if (typeof window === "undefined") return
    window.localStorage.removeItem(draftKey(key))
  }

  // Open modal for a new log entry
  const handleOpenNewLog = (aptId?: string) => {
    const resolvedAptId = aptId || appointments[0]?.id || "nueva"
    const draft = readDraft(resolvedAptId)

    setEditingLog(null)
    setSelectedAppointmentId(aptId || appointments[0]?.id || "")
    setSessionType(draft?.sessionType ?? "Seguimiento terapéutico")
    setSessionNotes(draft?.sessionNotes ?? "")
    setInterventions(draft?.interventions ?? "")
    setHomework(draft?.homework ?? "")
    setFormError("")
    setHasDraft(!!draft)
    setIsModalOpen(true)
  }

  // Open modal to edit an existing entry
  const handleOpenEditLog = (log: SessionLogEntry) => {
    const draft = readDraft(log.id)

    setEditingLog(log)
    setSelectedAppointmentId(log.appointmentId || "")
    setSessionType(draft?.sessionType ?? log.sessionType)
    setSessionNotes(draft?.sessionNotes ?? log.notes)
    setInterventions(draft?.interventions ?? (log.interventions || ""))
    setHomework(draft?.homework ?? (log.homework || ""))
    setFormError("")
    setHasDraft(!!draft)
    setIsModalOpen(true)
  }

  const handleSaveDraft = () => {
    const key = editingLog?.id || selectedAppointmentId || "nueva"
    window.localStorage.setItem(
      draftKey(key),
      JSON.stringify({ sessionType, sessionNotes, interventions, homework } satisfies BitacoraDraft),
    )
    setHasDraft(true)
    setSuccessToast("Borrador guardado. Puedes cerrar y continuar más tarde.")
    setTimeout(() => setSuccessToast(null), 4000)
  }

  // Quick insertion helpers for structured SOAP / clinical notes
  const insertTemplateSnippet = (snippet: string) => {
    setSessionNotes((prev) => {
      if (!prev.trim()) return snippet
      return `${prev}\n\n${snippet}`
    })
  }

  // Save bitacora entry
  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionNotes.trim()) {
      setFormError("Las observaciones y notas de la sesión son obligatorias.")
      return
    }

    setIsSaving(true)
    setFormError("")

    try {
      if (editingLog) {
        const updated = await logEntryService.update(editingLog.id, {
          appointmentId: selectedAppointmentId || undefined,
          sessionType,
          notes: sessionNotes,
          interventions,
          homework,
        })
        setLogs((prev) => prev.map((item) => (item.id === editingLog.id ? updated : item)))
        setSuccessToast("Nota de bitácora actualizada con trazabilidad.")
      } else {
        const created = await logEntryService.create(patientId, {
          appointmentId: selectedAppointmentId || undefined,
          sessionType,
          notes: sessionNotes,
          interventions,
          homework,
        })
        setLogs((prev) => [created, ...prev])
        setSuccessToast("Nueva nota de sesión registrada en la bitácora clínica.")
      }

      // Al sellar la entrada (nueva o editada) el borrador pendiente ya no aplica.
      clearDraft(editingLog?.id || selectedAppointmentId || "nueva")
      setHasDraft(false)
      setIsModalOpen(false)
      setTimeout(() => setSuccessToast(null), 3500)
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "No se pudo guardar la entrada de bitácora.",
      )
    } finally {
      setIsSaving(false)
    }
  }

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
        <div className="h-9 w-40 rounded-lg bg-muted/60" />
        <div className="h-48 rounded-2xl border border-border/70 bg-card" />
        <div className="h-64 rounded-2xl border border-border/70 bg-card" />
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
                      Nacimiento: {formatShortDate(patient.birthDate)}
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
                    {patient.email}
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
                  <span>+ Agendar Nueva Cita</span>
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

            {/* Tutor Legal (si aplica por ser menor o contar con registro) */}
            {patient.legalGuardian ? (
              <div className="p-3.5 rounded-xl border border-primary/25 bg-primary/[0.03] flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                    <ShieldCheck className="size-3.5" />
                    <span>Tutor Legal Responsable</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    {patient.legalGuardian.name}{" "}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({patient.legalGuardian.relationship})
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Doc: <span className="font-mono">{patient.legalGuardian.documentId}</span> · Tel: {patient.legalGuardian.phone}
                  </p>
                </div>
              </div>
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
          <TabsList className="bg-muted/70 p-1 rounded-xl">
            <TabsTrigger value="datos" className="rounded-lg text-xs font-semibold">
              Información General y Antecedentes
            </TabsTrigger>
            <TabsTrigger value="bitacora" className="rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <span>Bitácora de Sesiones</span>
              <span className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                {logs.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="citas" className="rounded-lg text-xs font-semibold">
              Historial de Citas ({appointments.length})
            </TabsTrigger>
          </TabsList>

          {/* Botón "+ Nueva Entrada de Bitácora" en la barra de pestañas */}
          {activeTab === "bitacora" && (
            <Button
              type="button"
              onClick={() => handleOpenNewLog()}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-2xs gap-1.5 shrink-0"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span>+ Nueva Entrada de Bitácora</span>
            </Button>
          )}
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
            <CardContent className="pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
                  <span className="text-xs font-semibold text-foreground">
                    Consentimiento Informado Vigente y Firmado
                  </span>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl">
                  El paciente o su tutor legal ha firmado digitalmente el consentimiento informado para la atención psicológica y el tratamiento de datos sensibles bajo la LFPDPPP.
                </p>
              </div>

              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                Firmado digitalmente
              </span>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== PESTAÑA 2: BITÁCORA DE SESIONES ==================== */}
        <TabsContent value="bitacora" className="space-y-4 pt-1">
          {/* Header Bar */}
          <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border/60 shadow-2xs">
            <div>
              <h3 className="font-heading font-semibold text-base text-foreground">
                Bitácora Cronológica de Sesiones
              </h3>
              <p className="text-xs text-muted-foreground">
                Registro de evolución clínica, intervenciones y acuerdos intersesión.
              </p>
            </div>

            <Button
              type="button"
              onClick={() => handleOpenNewLog()}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-2xs gap-1.5"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span>+ Nueva Entrada de Bitácora</span>
            </Button>
          </div>

          {/* Listado Cronológico de Notas */}
          <div className="space-y-4">
            {logs.length > 0 ? (
              logs.map((log) => (
                <Card
                  key={log.id}
                  className="border-border/70 shadow-2xs bg-card hover:border-primary/40 transition-all overflow-hidden"
                >
                  <CardHeader className="p-4 sm:p-5 border-b border-border/50 bg-muted/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-xl bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                        #{log.sessionNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-bold font-heading text-foreground">
                            Sesión #{log.sessionNumber} · {log.sessionType}
                          </CardTitle>
                          <Badge variant="outline" className="text-[10px] py-0 px-2 border-border/80">
                            {log.modality === AppointmentModality.VIRTUAL ? (
                              <span className="flex items-center gap-1 text-primary">
                                <Video className="size-3" /> Virtual
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="size-3" /> Presencial
                              </span>
                            )}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 pt-0.5">
                          <Clock className="size-3" />
                          <span>{formatShortDate(log.date)}</span>
                          <span>·</span>
                          <span>{log.psychologistName}</span>
                        </p>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEditLog(log)}
                      className="h-8 text-xs rounded-lg border-border/80 self-end sm:self-center gap-1"
                    >
                      <Edit3 className="size-3.5 text-muted-foreground" />
                      <span>Editar Nota</span>
                    </Button>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 space-y-3.5 text-xs text-foreground">
                    {/* Observaciones / Notas Clínicas */}
                    <div className="space-y-1">
                      <span className="block text-xs font-medium text-muted-foreground">
                        Observaciones Clínicas & Evolución:
                      </span>
                      <p className="leading-relaxed bg-muted/20 p-3.5 rounded-xl border border-border/40 whitespace-pre-line">
                        {log.notes}
                      </p>
                    </div>

                    {/* Intervenciones */}
                    {log.interventions && (
                      <div className="space-y-1">
                        <span className="block text-xs font-medium text-primary">
                          Técnicas e Intervenciones Aplicadas:
                        </span>
                        <p className="leading-relaxed bg-primary/[0.02] p-3 rounded-xl border border-primary/20 text-foreground">
                          {log.interventions}
                        </p>
                      </div>
                    )}

                    {/* Tareas Intersesión */}
                    {log.homework && (
                      <div className="space-y-1">
                        <span className="block text-xs font-medium text-muted-foreground">
                          Acuerdos y Tareas Intersesión:
                        </span>
                        <p className="leading-relaxed bg-muted/15 p-3 rounded-xl border border-border/40 text-foreground italic">
                          {log.homework}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="border-dashed border-border/80 p-8 text-center bg-card">
                <CardContent className="flex flex-col items-center justify-center gap-3">
                  <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <FileText className="size-6" />
                  </div>
                  <div>
                    <h4 className="font-heading font-semibold text-base text-foreground">
                      Aún no hay notas registradas en la bitácora
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-sm mt-1">
                      Comienza a documentar las intervenciones clínicas y observaciones terapéuticas de las sesiones del paciente.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => handleOpenNewLog()}
                    className="mt-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs h-9 px-4 shadow-2xs"
                  >
                    + Agregar Primera Nota
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
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
                      onClick={() => {
                        setActiveTab("bitacora")
                        handleOpenNewLog(apt.id)
                      }}
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

      {/* 4. MODAL / FORMULARIO: FORMULARIO BITÁCORA */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl p-6 bg-card border-border/80">
          <form onSubmit={handleSaveLog} className="space-y-4">
            <DialogHeader className="space-y-1.5">
              <DialogTitle className="text-xl font-heading font-semibold text-foreground">
                {editingLog ? `Modificar Sesión #${editingLog.sessionNumber}` : `Registrar Entrada en Bitácora`}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Documenta las observaciones, evolución y acuerdos terapéuticos para el expediente del paciente.
              </DialogDescription>
              {hasDraft && (
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 w-fit">
                  <Bookmark className="size-3.5" />
                  Reanudando un borrador guardado anteriormente
                </div>
              )}
            </DialogHeader>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-medium">
                {formError}
              </div>
            )}

            {/* CAMPO DE SOLO LECTURA: FECHA Y HORA ASOCIADA */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 grid sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <Lock className="size-3 text-muted-foreground" />
                  Fecha y Hora de la Sesión Asociada (Solo lectura)
                </span>
                <p className="font-semibold text-foreground font-mono">
                  {sessionDateString}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <User className="size-3 text-muted-foreground" />
                  Profesional Responsable (Solo lectura)
                </span>
                <p className="font-semibold text-foreground">
                  {psychologist?.name ?? "Profesional responsable"}
                  {psychologist?.licenseNumber ? ` · ${psychologist.licenseNumber}` : ""}
                </p>
              </div>
            </div>

            {/* Tipo de Sesión / Objetivo */}
            <div className="space-y-1">
              <label htmlFor="session-type-input" className="text-xs font-semibold text-foreground block">
                Tipo / Objetivo de la Sesión
              </label>
              <Input
                id="session-type-input"
                type="text"
                placeholder="Ej. Seguimiento terapéutico, Evaluación cognitiva, Psicoeducación..."
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="h-9 rounded-xl border-border/80 text-xs font-medium"
              />
            </div>

            {/* ÁREA DE TEXTO ENRIQUECIDO / AMPLIO */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="session-notes-textarea" className="text-xs font-semibold text-foreground block">
                  Observaciones, Seguimiento y Notas Terapéuticas <span className="text-rose-600">*</span>
                </label>

                {/* Snippet insertion shortcuts */}
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="text-muted-foreground hidden sm:inline">Insertar guía:</span>
                  <button
                    type="button"
                    onClick={() => insertTemplateSnippet("[Subjetivo]: El paciente refiere...\n[Objetivo]: Se observa afecto...")}
                    className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground font-mono text-[10px]"
                  >
                    SOAP
                  </button>
                  <button
                    type="button"
                    onClick={() => insertTemplateSnippet("[Intervención]: Se aplicó técnica de reestructuración cognitiva...")}
                    className="px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground font-mono text-[10px]"
                  >
                    Técnica
                  </button>
                </div>
              </div>

              <Textarea
                id="session-notes-textarea"
                placeholder="Captura de forma amplia y detallada las observaciones clínicas, evolución del paciente, estado emocional y temas tratados durante la sesión..."
                value={sessionNotes}
                onChange={(e) => {
                  setSessionNotes(e.target.value)
                  if (formError) setFormError("")
                }}
                className="min-h-[160px] rounded-xl border-border/80 focus-visible:ring-primary/20 text-xs leading-relaxed font-sans"
              />
            </div>

            {/* Técnicas e Intervenciones */}
            <div className="space-y-1">
              <label htmlFor="session-interventions-textarea" className="text-xs font-semibold text-foreground block">
                Técnicas e Intervenciones Aplicadas (Opcional)
              </label>
              <Input
                id="session-interventions-textarea"
                type="text"
                placeholder="Ej. Reestructuración cognitiva, desensibilización sistemática, respiración diafragmática..."
                value={interventions}
                onChange={(e) => setInterventions(e.target.value)}
                className="h-9 rounded-xl border-border/80 text-xs"
              />
            </div>

            {/* Tareas / Compromisos Intersesión */}
            <div className="space-y-1">
              <label htmlFor="session-homework-textarea" className="text-xs font-semibold text-foreground block">
                Acuerdos y Tareas Intersesión para el Paciente (Opcional)
              </label>
              <Input
                id="session-homework-textarea"
                type="text"
                placeholder="Ej. Registro ABC de pensamientos automáticos, 15 min de relajación progresiva..."
                value={homework}
                onChange={(e) => setHomework(e.target.value)}
                className="h-9 rounded-xl border-border/80 text-xs"
              />
            </div>

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="h-9 rounded-xl border-border/80 text-xs"
              >
                Cancelar
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={!sessionNotes.trim() && !interventions.trim() && !homework.trim()}
                className="h-9 rounded-xl border-border/80 text-xs gap-1.5 sm:mr-auto"
              >
                <Bookmark className="size-3.5" />
                Guardar borrador
              </Button>

              <Button
                type="submit"
                disabled={isSaving}
                className="h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-2xs gap-1.5"
              >
                <Save className="size-4" />
                <span>{isSaving ? "Guardando…" : "Guardar Entrada"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
