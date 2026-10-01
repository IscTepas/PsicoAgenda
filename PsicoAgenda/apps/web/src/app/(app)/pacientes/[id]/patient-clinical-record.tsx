"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  CalendarDays,
  Clock,
  FileText,
  Plus,
  ShieldCheck,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Video,
  User,
  Check,
  CheckCircle2,
  Lock,
  Edit3,
  Sparkles,
  BookmarkCheck,
  Copy,
  ExternalLink,
  ChevronRight,
  ClipboardList,
  Save,
  X,
} from "lucide-react"
import {
  APP_NAME,
  AppointmentModality,
  type Patient,
  type Appointment,
} from "@psicoagenda/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  MOCK_CLINICAL_RECORD,
  MOCK_PSYCHOLOGIST,
  type SessionLogEntry,
  formatAppointmentTime,
  formatShortDate,
} from "@/lib/mock-data"

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
  patient: Patient
  appointments: Appointment[]
  initialLogs: SessionLogEntry[]
}

export function PatientClinicalRecord({
  patient,
  appointments,
  initialLogs,
}: PatientClinicalRecordProps) {
  const [activeTab, setActiveTab] = React.useState<string>("datos")
  const [logs, setLogs] = React.useState<SessionLogEntry[]>(initialLogs)

  // Bitacora modal state
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false)
  const [editingLog, setEditingLog] = React.useState<SessionLogEntry | null>(null)
  const [selectedAppointmentId, setSelectedAppointmentId] = React.useState<string>("")
  const [sessionType, setSessionType] = React.useState<string>("Seguimiento terapéutico")
  const [sessionNotes, setSessionNotes] = React.useState<string>("")
  const [interventions, setInterventions] = React.useState<string>("")
  const [homework, setHomework] = React.useState<string>("")
  const [formError, setFormError] = React.useState<string>("")
  const [copiedPhone, setCopiedPhone] = React.useState<boolean>(false)
  const [successToast, setSuccessToast] = React.useState<string | null>(null)

  const age = calculateAge(patient.birthDate)

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

  // Open modal for a new log entry
  const handleOpenNewLog = (aptId?: string) => {
    setEditingLog(null)
    setSelectedAppointmentId(aptId || appointments[0]?.id || "")
    setSessionType("Seguimiento terapéutico")
    setSessionNotes("")
    setInterventions("")
    setHomework("")
    setFormError("")
    setIsModalOpen(true)
  }

  // Open modal to edit an existing entry
  const handleOpenEditLog = (log: SessionLogEntry) => {
    setEditingLog(log)
    setSelectedAppointmentId(log.appointmentId || "")
    setSessionType(log.sessionType)
    setSessionNotes(log.notes)
    setInterventions(log.interventions || "")
    setHomework(log.homework || "")
    setFormError("")
    setIsModalOpen(true)
  }

  // Quick insertion helpers for structured SOAP / clinical notes
  const insertTemplateSnippet = (snippet: string) => {
    setSessionNotes((prev) => {
      if (!prev.trim()) return snippet
      return `${prev}\n\n${snippet}`
    })
  }

  // Save bitacora entry
  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault()
    if (!sessionNotes.trim()) {
      setFormError("Las observaciones y notas de la sesión son obligatorias.")
      return
    }

    if (editingLog) {
      // Update existing
      setLogs((prev) =>
        prev.map((item) =>
          item.id === editingLog.id
            ? {
                ...item,
                sessionType,
                notes: sessionNotes,
                interventions,
                homework,
                updatedAt: new Date(),
              }
            : item
        )
      )
      setSuccessToast("Nota de bitácora actualizada con trazabilidad.")
    } else {
      // Create new
      const newEntry: SessionLogEntry = {
        id: `log-${Date.now()}`,
        patientId: patient.id,
        appointmentId: selectedAppointmentId || undefined,
        sessionNumber: logs.length + 1,
        date: associatedAppointment?.startTime || new Date(),
        psychologistName: MOCK_PSYCHOLOGIST.name,
        modality: associatedAppointment?.modality || AppointmentModality.IN_PERSON,
        sessionType,
        notes: sessionNotes,
        interventions,
        homework,
        createdAt: new Date(),
      }
      setLogs((prev) => [newEntry, ...prev])
      setSuccessToast("Nueva nota de sesión registrada en la bitácora clínica.")
    }

    setIsModalOpen(false)
    setTimeout(() => {
      setSuccessToast(null)
    }, 3500)
  }

  // Copy emergency contact phone
  const copyEmergencyPhone = (phone?: string) => {
    if (!phone) return
    navigator.clipboard.writeText(phone)
    setCopiedPhone(true)
    setTimeout(() => setCopiedPhone(false), 2000)
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
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CheckCircle2 className="size-3 mr-1 text-emerald-600" /> Expediente Activo
          </Badge>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Uso Clínico Exclusivo
          </span>
        </div>
      </div>

      {/* SUCCESS TOAST BANNER */}
      {successToast && (
        <div className="p-3.5 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 flex items-center justify-between animate-in fade-in-50">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            className="text-emerald-700 hover:text-emerald-900"
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
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
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
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
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
              Datos Generales
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

          {/* Botón "+ Agregar Nota de Sesión" en la barra de pestañas */}
          {activeTab === "bitacora" && (
            <Button
              type="button"
              onClick={() => handleOpenNewLog()}
              className="h-9 px-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-2xs gap-1.5 shrink-0"
            >
              <Plus className="size-4 stroke-[2.5]" />
              <span>+ Agregar Nota de Sesión</span>
            </Button>
          )}
        </div>

        {/* ==================== PESTAÑA 1: DATOS GENERALES ==================== */}
        <TabsContent value="datos" className="space-y-6 pt-1">
          {/* Card: Diagnóstico Inicial y Motivo Clínico */}
          <Card className="border-border/70 shadow-2xs bg-card">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground font-heading flex items-center gap-2">
                  <BookmarkCheck className="size-4 text-primary" />
                  <span>Diagnóstico Clínico Inicial (CIE-10)</span>
                </CardTitle>
                <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-semibold text-xs">
                  CIE-10: F41.1
                </Badge>
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                Impresión diagnóstica principal establecida al inicio del proceso terapéutico.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className="p-4 rounded-xl bg-primary/[0.03] border border-primary/20 space-y-1">
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Trastorno Diagnósticado
                </span>
                <p className="text-base font-bold text-foreground">
                  {MOCK_CLINICAL_RECORD.diagnosis}
                </p>
                <p className="text-xs text-muted-foreground pt-1">
                  Apertura oficial del expediente: <strong>{formatShortDate(MOCK_CLINICAL_RECORD.openedAt)}</strong> · Última revisión: <strong>{formatShortDate(MOCK_CLINICAL_RECORD.updatedAt)}</strong>
                </p>
              </div>

              {/* Antecedentes clínicos y familiares */}
              <div className="space-y-1.5 pt-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <FileText className="size-3.5 text-muted-foreground" />
                  <span>Antecedentes Clínicos y Familiares</span>
                </h4>
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs text-foreground leading-relaxed">
                  {MOCK_CLINICAL_RECORD.background}
                </div>
              </div>

              {/* Alergias / Alertas Clínicas */}
              <div className="space-y-1.5 pt-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider text-rose-700 dark:text-rose-400">
                  <AlertTriangle className="size-3.5 text-rose-500" />
                  <span>Alergias y Alertas Médicas Relevantes</span>
                </h4>
                <div className="p-3.5 rounded-xl border border-rose-200/80 bg-rose-50/40 dark:bg-rose-950/20 dark:border-rose-900/50 text-xs text-rose-950 dark:text-rose-200 leading-relaxed font-medium">
                  {MOCK_CLINICAL_RECORD.allergies}
                </div>
              </div>

              {/* Observaciones Generales */}
              <div className="space-y-1.5 pt-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                  <ClipboardList className="size-3.5 text-muted-foreground" />
                  <span>Observaciones Generales de Evolución</span>
                </h4>
                <div className="p-3.5 rounded-xl border border-border/60 bg-muted/20 text-xs text-foreground leading-relaxed">
                  {MOCK_CLINICAL_RECORD.generalObservations}
                </div>
              </div>
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
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-foreground">
                    Consentimiento Informado Vigente y Firmado
                  </span>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl">
                  El paciente o su tutor legal ha firmado digitalmente el consentimiento informado para la atención psicológica y el tratamiento de datos sensibles bajo la LFPDPPP.
                </p>
              </div>

              <Badge variant="outline" className="w-fit text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
                Firmado Digitalmente ✅
              </Badge>
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
              <span>+ Agregar Nota de Sesión</span>
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
                      <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                        Observaciones Clínicas & Evolución:
                      </span>
                      <p className="leading-relaxed bg-muted/20 p-3.5 rounded-xl border border-border/40 whitespace-pre-line">
                        {log.notes}
                      </p>
                    </div>

                    {/* Intervenciones */}
                    {log.interventions && (
                      <div className="space-y-1">
                        <span className="font-semibold text-primary uppercase text-[10px] tracking-wider block">
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
                        <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wider block">
                          Acuerdos y Tareas Intersesión:
                        </span>
                        <p className="leading-relaxed bg-muted/15 p-3 rounded-xl border border-border/40 text-foreground italic">
                          📝 {log.homework}
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
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {apt.status}
                      </Badge>
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
              <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
                <FileText className="size-4" />
                <span>{editingLog ? "Editar Entrada de Bitácora" : "Nueva Nota de Sesión Clínica"}</span>
              </div>
              <DialogTitle className="text-xl font-heading font-semibold text-foreground">
                {editingLog ? `Modificar Sesión #${editingLog.sessionNumber}` : `Registrar Entrada en Bitácora`}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Documenta las observaciones, evolución y acuerdos terapéuticos para el expediente del paciente.
              </DialogDescription>
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
                  {MOCK_PSYCHOLOGIST.name} · {MOCK_PSYCHOLOGIST.licenseNumber}
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
                type="submit"
                className="h-9 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs shadow-2xs gap-1.5"
              >
                <Save className="size-4" />
                <span>Guardar Entrada</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
